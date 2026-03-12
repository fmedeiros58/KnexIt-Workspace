import { execFileSync } from "node:child_process";

const DEFAULT_ANM_BASE_URL = "http://127.0.0.1:8100";
const WSL_DISCOVERY_CACHE_MS = 60_000;
const ANM_RESOLUTION_CACHE_MS = Math.max(500, Number(process.env.ANM_BASE_URL_RESOLUTION_CACHE_MS || 3_000));

type ResolutionCache = {
  key: string;
  expiresAt: number;
  value: ResolvedAnmBaseUrl;
};

let wslDiscoveryCache: { key: string; checkedAt: number; urls: string[] } | null = null;
let anmResolutionCache: ResolutionCache | null = null;

export type ResolvedAnmBaseUrl = {
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

export function readConfiguredAnmBaseUrl(defaultBaseUrl = DEFAULT_ANM_BASE_URL) {
  return normalizeUrl(pickFirstNonEmpty(process.env.ANM_BACKEND_BASE_URL, defaultBaseUrl));
}

export function resolveAnmBaseUrlCandidates(configuredBaseUrl: string) {
  const configured = normalizeUrl(configuredBaseUrl || DEFAULT_ANM_BASE_URL);
  const fallbackBaseUrls = parseBaseUrlList(
    pickFirstNonEmpty(process.env.ANM_BACKEND_BASE_URL_FALLBACKS, ""),
  ).filter((item) => item !== configured);

  const seedUrls = [configured, ...fallbackBaseUrls].filter(Boolean);
  const result: string[] = [];
  const seen = new Set<string>();
  for (const candidate of seedUrls) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    result.push(candidate);
  }

  if (!parseBooleanFlag(process.env.ANM_WSL_DISCOVERY_ENABLED, true)) {
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
    process.env.ANM_WSL_HOST_IP,
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.max(300, timeoutMs));
  try {
    const response = await fetch(`${baseUrl}${healthPath}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    return {
      ok: response.ok,
      status: response.status,
      detail: response.ok ? "ok" : `HTTP_${response.status}`,
    };
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === "AbortError";
    return {
      ok: false,
      status: timeout ? 504 : 0,
      detail: timeout ? "timeout" : "unreachable",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function resolveReachableAnmBaseUrl(input?: {
  configuredBaseUrl?: string;
  timeoutMs?: number;
  healthPath?: string;
}) {
  const configuredBaseUrl = readConfiguredAnmBaseUrl(input?.configuredBaseUrl || DEFAULT_ANM_BASE_URL);
  const timeoutMs = Number.isFinite(Number(input?.timeoutMs)) ? Math.max(300, Number(input?.timeoutMs)) : 1_500;
  const healthPath = `${input?.healthPath || "/healthz"}`.trim() || "/healthz";
  const attemptedBaseUrls = resolveAnmBaseUrlCandidates(configuredBaseUrl);
  const key = `${configuredBaseUrl}|${attemptedBaseUrls.join("|")}|${timeoutMs}|${healthPath}`;
  const now = Date.now();

  if (anmResolutionCache && anmResolutionCache.key === key && anmResolutionCache.expiresAt > now) {
    return anmResolutionCache.value;
  }

  for (const candidate of attemptedBaseUrls) {
    const probe = await probeAnmBaseUrl(candidate, timeoutMs, healthPath);
    if (probe.ok) {
      const value: ResolvedAnmBaseUrl = {
        baseUrl: candidate,
        configuredBaseUrl,
        attemptedBaseUrls,
        reachable: true,
        detail: probe.detail,
      };
      anmResolutionCache = {
        key,
        expiresAt: now + ANM_RESOLUTION_CACHE_MS,
        value,
      };
      return value;
    }
  }

  const value: ResolvedAnmBaseUrl = {
    baseUrl: attemptedBaseUrls[0] || configuredBaseUrl,
    configuredBaseUrl,
    attemptedBaseUrls: attemptedBaseUrls.length ? attemptedBaseUrls : [configuredBaseUrl],
    reachable: false,
    detail: "unreachable",
  };
  anmResolutionCache = {
    key,
    expiresAt: now + ANM_RESOLUTION_CACHE_MS,
    value,
  };
  return value;
}
