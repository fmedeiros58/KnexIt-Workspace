import { execFileSync } from "node:child_process";

const DEFAULT_AI_SYSTEM_ANM_BASE_URL = "http://127.0.0.1:3000";
const WSL_DISCOVERY_CACHE_MS = 60_000;

function readEnvCompat(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

const AI_SYSTEM_ANM_RESOLUTION_CACHE_MS = Math.max(
  500,
  Number(readEnvCompat("AI_SYSTEM_ANM_BASE_URL_RESOLUTION_CACHE_MS") || 3_000),
);
const AI_SYSTEM_ANM_STICKY_REACHABLE_MS = Math.max(
  1_000,
  Number(readEnvCompat("AI_SYSTEM_ANM_BASE_URL_STICKY_REACHABLE_MS") || 120_000),
);

type ResolutionCache = {
  key: string;
  expiresAt: number;
  value: ResolvedAiSystemAnmBaseUrl;
};

let wslDiscoveryCache: { key: string; checkedAt: number; urls: string[] } | null = null;
let anmResolutionCache: ResolutionCache | null = null;
let stickyReachableBaseUrlCache: { baseUrl: string; expiresAt: number } | null = null;

export type ResolvedAiSystemAnmBaseUrl = {
  baseUrl: string;
  configuredBaseUrl: string;
  attemptedBaseUrls: string[];
  reachable: boolean;
  detail: string;
};

function pickFirstNonEmpty(...values: Array<string | undefined | null>) {
  for (const value of values) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) return trimmed;
  }
  return "";
}

function normalizeUrl(value: string) {
  return `${value || ""}`.trim().replace(/\/+$/, "");
}

function normalizeHealthPath(value: string) {
  const trimmed = `${value || ""}`.trim();
  if (!trimmed) return "/healthz";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function buildHealthPathCandidates(healthPath: string) {
  const normalized = normalizeHealthPath(healthPath);
  const candidates: string[] = [];
  const seen = new Set<string>();
  const push = (value: string) => {
    const candidate = normalizeHealthPath(value);
    if (seen.has(candidate)) return;
    seen.add(candidate);
    candidates.push(candidate);
  };

  if (normalized === "/healthz" || normalized === "/api/healthz") {
    // Prioriza o path canônico do Next, mantendo compatibilidade com serviços legados.
    push("/api/healthz");
    push("/healthz");
    return candidates;
  }

  push(normalized);
  return candidates;
}

function parseBooleanFlag(value: string | undefined, fallback: boolean) {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parseBaseUrlList(value: string) {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const token of value.split(/[,\n;]+/g)) {
    const normalized = normalizeUrl(token);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function isLoopbackHostname(hostname: string) {
  const normalized = (hostname || "").trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "localhost";
}

function isIpv4Address(value: string) {
  const parts = value.trim().split(".");
  if (parts.length !== 4) return false;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return false;
    const parsed = Number(part);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 255) return false;
  }
  return true;
}

function replaceHostname(baseUrl: string, host: string) {
  try {
    const parsed = new URL(baseUrl);
    parsed.hostname = host;
    return normalizeUrl(parsed.toString());
  } catch {
    return "";
  }
}

function resolveKubernetesServiceBaseUrl(configuredBaseUrl: string) {
  if (!process.env.KUBERNETES_SERVICE_HOST) return "";

  const explicit = normalizeUrl(
    pickFirstNonEmpty(
      readEnvCompat("AI_SYSTEM_ANM_K8S_API_BASE_URL"),
      readEnvCompat("AI_SYSTEM_ANM_CLUSTER_API_BASE_URL"),
    ),
  );
  if (explicit) return explicit;

  return normalizeUrl(configuredBaseUrl || DEFAULT_AI_SYSTEM_ANM_BASE_URL);
}

function tryDiscoverWslHostIp() {
  try {
    const output = execFileSync(
      "wsl.exe",
      ["-e", "bash", "-lc", "hostname -I 2>/dev/null | awk '{print $1}'"],
      {
        encoding: "utf8",
        timeout: 1_200,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    return `${output || ""}`.trim();
  } catch {
    return "";
  }
}

export function readConfiguredAiSystemAnmBaseUrl(defaultBaseUrl = DEFAULT_AI_SYSTEM_ANM_BASE_URL) {
  return normalizeUrl(
    pickFirstNonEmpty(
      readEnvCompat("AI_SYSTEM_ANM_API_BASE_URL"),
      defaultBaseUrl,
    ),
  );
}

export function resolveAiSystemAnmBaseUrlCandidates(configuredBaseUrl: string) {
  const configured = normalizeUrl(configuredBaseUrl || DEFAULT_AI_SYSTEM_ANM_BASE_URL);
  const fallbackBaseUrls = parseBaseUrlList(
    pickFirstNonEmpty(
      readEnvCompat("AI_SYSTEM_ANM_API_BASE_URL_FALLBACKS"),
      "",
    ),
  ).filter((item) => item !== configured);

  const seedUrls = [configured, ...fallbackBaseUrls].filter(Boolean);
  const result: string[] = [];
  const seen = new Set<string>();
  for (const candidate of seedUrls) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    result.push(candidate);
  }

  const k8sCandidate = resolveKubernetesServiceBaseUrl(configured);
  if (k8sCandidate && !seen.has(k8sCandidate)) {
    seen.add(k8sCandidate);
    result.push(k8sCandidate);
  }

  if (!parseBooleanFlag(readEnvCompat("AI_SYSTEM_ANM_WSL_DISCOVERY_ENABLED"), true)) {
    return result;
  }
  if (process.platform !== "win32") {
    return result;
  }

  const loopbackSeeds = result.filter((baseUrl) => {
    try {
      return isLoopbackHostname(new URL(baseUrl).hostname);
    } catch {
      return false;
    }
  });
  if (!loopbackSeeds.length) {
    return result;
  }

  const cacheKey = loopbackSeeds.join("|");
  const now = Date.now();
  if (wslDiscoveryCache && wslDiscoveryCache.key === cacheKey && now - wslDiscoveryCache.checkedAt < WSL_DISCOVERY_CACHE_MS) {
    for (const url of wslDiscoveryCache.urls) {
      if (!seen.has(url)) {
        seen.add(url);
        result.push(url);
      }
    }
    return result;
  }

  const configuredHost = pickFirstNonEmpty(
    readEnvCompat("AI_SYSTEM_ANM_WSL_HOST_IP"),
    process.env.KNEXAI_WSL_HOST_IP,
    process.env.LOCAL_WSL_HOST_IP,
  );
  const discoveredHosts: string[] = [];
  if (isIpv4Address(configuredHost)) {
    discoveredHosts.push(configuredHost);
  } else {
    const discoveredHost = tryDiscoverWslHostIp();
    if (isIpv4Address(discoveredHost)) {
      discoveredHosts.push(discoveredHost);
    }
  }

  const urls = Array.from(
    new Set(
      discoveredHosts.flatMap((host) =>
        loopbackSeeds
          .map((baseUrl) => replaceHostname(baseUrl, host))
          .filter(Boolean),
      ),
    ),
  );
  wslDiscoveryCache = {
    key: cacheKey,
    checkedAt: now,
    urls,
  };
  for (const url of urls) {
    if (!seen.has(url)) {
      seen.add(url);
      result.push(url);
    }
  }

  return result;
}

async function probeAnmBaseUrl(baseUrl: string, timeoutMs: number, healthPath: string) {
  const healthPaths = buildHealthPathCandidates(healthPath);
  let lastStatus = 0;
  let lastDetail = "unreachable";

  for (const candidatePath of healthPaths) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.max(300, timeoutMs));
    try {
      const response = await fetch(`${baseUrl}${candidatePath}`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.ok) {
        return {
          ok: true,
          status: response.status,
          detail: `ok:${candidatePath}`,
        };
      }
      lastStatus = response.status;
      lastDetail = `HTTP_${response.status}:${candidatePath}`;
    } catch (error) {
      const timeout = error instanceof DOMException && error.name === "AbortError";
      lastStatus = timeout ? 504 : 0;
      lastDetail = timeout ? `timeout:${candidatePath}` : `unreachable:${candidatePath}`;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    ok: false,
    status: lastStatus,
    detail: lastDetail,
  };
}

export async function resolveReachableAiSystemAnmBaseUrl(input?: {
  configuredBaseUrl?: string;
  timeoutMs?: number;
  healthPath?: string;
}) {
  const configuredBaseUrl = readConfiguredAiSystemAnmBaseUrl(input?.configuredBaseUrl || DEFAULT_AI_SYSTEM_ANM_BASE_URL);
  const timeoutMs = Number.isFinite(Number(input?.timeoutMs)) ? Math.max(300, Number(input?.timeoutMs)) : 1_500;
  const healthPath = normalizeHealthPath(input?.healthPath || "/healthz");
  const healthPathCandidates = buildHealthPathCandidates(healthPath);
  const attemptedBaseUrls = resolveAiSystemAnmBaseUrlCandidates(configuredBaseUrl);
  const key = `${configuredBaseUrl}|${attemptedBaseUrls.join("|")}|${timeoutMs}|${healthPathCandidates.join(",")}`;
  const now = Date.now();

  if (anmResolutionCache && anmResolutionCache.key === key && anmResolutionCache.expiresAt > now) {
    return anmResolutionCache.value;
  }

  for (const candidate of attemptedBaseUrls) {
    const probe = await probeAnmBaseUrl(candidate, timeoutMs, healthPath);
    if (probe.ok) {
      stickyReachableBaseUrlCache = {
        baseUrl: candidate,
        expiresAt: now + AI_SYSTEM_ANM_STICKY_REACHABLE_MS,
      };
      const value: ResolvedAiSystemAnmBaseUrl = {
        baseUrl: candidate,
        configuredBaseUrl,
        attemptedBaseUrls,
        reachable: true,
        detail: probe.detail,
      };
      anmResolutionCache = {
        key,
        expiresAt: now + AI_SYSTEM_ANM_RESOLUTION_CACHE_MS,
        value,
      };
      return value;
    }
  }

  if (
    stickyReachableBaseUrlCache &&
    stickyReachableBaseUrlCache.expiresAt > now &&
    stickyReachableBaseUrlCache.baseUrl
  ) {
    const value: ResolvedAiSystemAnmBaseUrl = {
      baseUrl: stickyReachableBaseUrlCache.baseUrl,
      configuredBaseUrl,
      attemptedBaseUrls: attemptedBaseUrls.length ? attemptedBaseUrls : [configuredBaseUrl],
      reachable: true,
      detail: "sticky_last_reachable",
    };
    anmResolutionCache = {
      key,
      expiresAt: now + AI_SYSTEM_ANM_RESOLUTION_CACHE_MS,
      value,
    };
    return value;
  }

  const value: ResolvedAiSystemAnmBaseUrl = {
    baseUrl: attemptedBaseUrls[0] || configuredBaseUrl,
    configuredBaseUrl,
    attemptedBaseUrls: attemptedBaseUrls.length ? attemptedBaseUrls : [configuredBaseUrl],
    reachable: false,
    detail: "unreachable",
  };
  anmResolutionCache = {
    key,
    expiresAt: now + AI_SYSTEM_ANM_RESOLUTION_CACHE_MS,
    value,
  };
  return value;
}



