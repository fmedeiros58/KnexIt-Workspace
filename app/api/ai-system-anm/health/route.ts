import { NextResponse } from "next/server";
import { execFileSync } from "node:child_process";
import { readConfiguredAiSystemAnmBaseUrl, resolveReachableAiSystemAnmBaseUrl } from "@/app/api/_shared/ai-system-anm-endpoint";

export const runtime = "nodejs";

const DEFAULT_BASE_URL = "http://127.0.0.1:8000/v1";
const DEFAULT_MODEL = "mistral-awq";
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_AI_SYSTEM_ANM_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_AI_SYSTEM_ANM_TIMEOUT_MS = 8_000;
const WSL_DISCOVERY_CACHE_MS = 60_000;

type EngineMode = "direct" | "ai_system_anm";
type EngineModeConfig = {
  mode: EngineMode;
  anmBaseUrl: string;
  anmTimeoutMs: number;
  fallbackToDirect: boolean;
};

let wslDiscoveryCache: { key: string; checkedAt: number; urls: string[] } | null = null;

function pickFirstNonEmpty(...values: Array<string | undefined | null>) {
  for (const value of values) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) return trimmed;
  }
  return "";
}

function readAnmCompatEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeUrl(value: string) {
  return value.replace(/\/+$/, "");
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
    const normalized = normalizeUrl(token.trim());
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
        timeout: 1200,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    return `${output || ""}`.trim();
  } catch {
    return "";
  }
}

function resolveLogicalModelName() {
  const explicit = pickFirstNonEmpty(process.env.LLM_MODEL_NAME);
  if (explicit) return explicit;

  const compatModel = pickFirstNonEmpty(process.env.VLLM_MODEL);
  if (compatModel && !compatModel.includes("/") && !compatModel.includes("\\")) return compatModel;

  return DEFAULT_MODEL;
}

function readLlmConfig() {
  const baseUrl = normalizeUrl(pickFirstNonEmpty(process.env.LOCAL_LLM_BASE_URL, process.env.LLM_BASE_URL, process.env.VLLM_BASE_URL, DEFAULT_BASE_URL));
  const fallbackBaseUrls = parseBaseUrlList(
    pickFirstNonEmpty(
      process.env.KNEXAI_LLM_FALLBACK_BASE_URLS,
      process.env.LOCAL_LLM_FALLBACK_BASE_URLS,
      process.env.LLM_FALLBACK_BASE_URLS,
      "",
    ),
  ).filter((item) => item !== baseUrl);
  const model = resolveLogicalModelName();
  const apiKey = pickFirstNonEmpty(process.env.LOCAL_LLM_API_KEY, process.env.VLLM_API_KEY, process.env.LLM_API_KEY, "token-local");
  const timeout = Number(process.env.LLM_TIMEOUT_MS || process.env.VLLM_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(timeout) ? Math.max(2_000, timeout) : DEFAULT_TIMEOUT_MS;
  return { baseUrl, fallbackBaseUrls, model, apiKey, timeoutMs };
}

function readEngineModeConfig(): EngineModeConfig {
  // Runtime atual: direct-only no endpoint principal /api/ai-system-anm.
  const mode: EngineMode = "direct";
  const anmBaseUrl = readConfiguredAiSystemAnmBaseUrl(
    pickFirstNonEmpty(
      readAnmCompatEnv("AI_SYSTEM_ANM_API_BASE_URL"),
      DEFAULT_AI_SYSTEM_ANM_BASE_URL,
    ),
  );
  const parsedTimeout = Number(
    readAnmCompatEnv("AI_SYSTEM_ANM_API_TIMEOUT_MS") || DEFAULT_AI_SYSTEM_ANM_TIMEOUT_MS,
  );
  const anmTimeoutMs = Number.isFinite(parsedTimeout) ? Math.max(2_000, parsedTimeout) : DEFAULT_AI_SYSTEM_ANM_TIMEOUT_MS;
  const fallbackRaw = pickFirstNonEmpty(
    readAnmCompatEnv("KNEXAI_AI_SYSTEM_ANM_FALLBACK_TO_DIRECT"),
    "1",
  ).toLowerCase();
  const fallbackToDirect = !["0", "false", "no", "off"].includes(fallbackRaw);
  return { mode, anmBaseUrl, anmTimeoutMs, fallbackToDirect };
}

function resolveDynamicLlmFallbackUrls(seedUrls: string[]) {
  if (!parseBooleanFlag(process.env.KNEXAI_LLM_WSL_DISCOVERY_ENABLED, true)) return [];
  if (process.platform !== "win32") return [];

  const loopbackSeeds = seedUrls.filter((baseUrl) => {
    try {
      return isLoopbackHostname(new URL(baseUrl).hostname);
    } catch {
      return false;
    }
  });
  if (!loopbackSeeds.length) return [];

  const cacheKey = loopbackSeeds.join("|");
  const now = Date.now();
  if (wslDiscoveryCache && wslDiscoveryCache.key === cacheKey && now - wslDiscoveryCache.checkedAt < WSL_DISCOVERY_CACHE_MS) {
    return wslDiscoveryCache.urls;
  }

  const configuredHost = pickFirstNonEmpty(
    process.env.KNEXAI_WSL_HOST_IP,
    process.env.LOCAL_WSL_HOST_IP,
    process.env.RAG_LLM_WSL_HOST_IP,
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
  return urls;
}

function resolveLlmBaseUrlCandidates(config: { baseUrl: string; fallbackBaseUrls: string[] }) {
  const seedUrls = [normalizeUrl(config.baseUrl), ...config.fallbackBaseUrls.map((item) => normalizeUrl(item))];
  const dynamicFallbacks = resolveDynamicLlmFallbackUrls(seedUrls);
  return Array.from(new Set([...seedUrls, ...dynamicFallbacks].filter(Boolean)));
}

async function probeAnm(baseUrl: string, timeoutMs: number) {
  const endpoints = ["/api/healthz", "/healthz", "/admin/health"];
  const startedAt = Date.now();
  let lastStatus = 0;
  let lastMessage = "";

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
      });
      lastStatus = response.status;
      const payload = await response.json().catch(() => null);
      if (response.ok) {
        return {
          ok: true,
          endpoint,
          status: response.status,
          elapsedMs: Date.now() - startedAt,
          payload,
          error: null,
        };
      }
      const bodyText = await response.text().catch(() => "");
      lastMessage = bodyText.slice(0, 200);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        lastStatus = 504;
        lastMessage = "timeout";
      } else {
        lastStatus = 503;
        lastMessage = "unreachable";
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    ok: false,
    endpoint: null,
    status: lastStatus || 503,
    elapsedMs: Date.now() - startedAt,
    payload: null,
    error: lastMessage || "ANM backend indisponivel.",
  };
}

export async function GET() {
  const engineMode = readEngineModeConfig();

  if (engineMode.mode === "ai_system_anm") {
    const anmResolution = await resolveReachableAiSystemAnmBaseUrl({
      configuredBaseUrl: engineMode.anmBaseUrl,
      timeoutMs: Math.min(2_000, engineMode.anmTimeoutMs),
      healthPath: "/healthz",
    });
    const anmProbe = await probeAnm(anmResolution.baseUrl, engineMode.anmTimeoutMs);
    if (!anmProbe.ok) {
      return NextResponse.json(
        {
          ok: false,
          provider: "ai-system-anm",
          engineMode: engineMode.mode,
          anmReachable: false,
          anmBaseUrl: anmResolution.baseUrl,
          anmConfiguredBaseUrl: engineMode.anmBaseUrl,
          anmAttemptedBaseUrls: anmResolution.attemptedBaseUrls,
          anmFallbackToDirect: engineMode.fallbackToDirect,
          status: anmProbe.status,
          elapsedMs: anmProbe.elapsedMs,
          message: anmProbe.error,
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        provider: "ai-system-anm",
        engineMode: engineMode.mode,
        anmReachable: true,
        anmBaseUrl: anmResolution.baseUrl,
        anmConfiguredBaseUrl: engineMode.anmBaseUrl,
        anmAttemptedBaseUrls: anmResolution.attemptedBaseUrls,
        anmEndpoint: anmProbe.endpoint,
        anmFallbackToDirect: engineMode.fallbackToDirect,
        status: anmProbe.status,
        elapsedMs: anmProbe.elapsedMs,
        payload: anmProbe.payload,
      },
      { status: 200 },
    );
  }

  const config = readLlmConfig();
  const candidates = resolveLlmBaseUrlCandidates(config);
  const attempts: Array<{ baseUrl: string; status: number; detail: string }> = [];

  for (const baseUrl of candidates) {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(`${baseUrl}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
        signal: controller.signal,
        cache: "no-store",
      });

      const elapsedMs = Date.now() - startedAt;
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        attempts.push({ baseUrl, status: response.status, detail: body.slice(0, 200) });
        continue;
      }

      const payload = await response.json().catch(() => null);
      const listedModels = Array.isArray((payload as { data?: unknown[] } | null)?.data)
        ? ((payload as { data: Array<{ id?: string }> }).data ?? [])
            .map((item) => item?.id)
            .filter((id): id is string => typeof id === "string")
        : [];

      return NextResponse.json(
        {
          ok: true,
          provider: "direct",
          engineMode: engineMode.mode,
          llmReachable: true,
          status: 200,
          model: config.model,
          modelAvailable: listedModels.length ? listedModels.includes(config.model) : null,
          listedModels: listedModels.slice(0, 20),
          baseUrl,
          configuredBaseUrl: config.baseUrl,
          attemptedBaseUrls: candidates,
          elapsedMs,
        },
        { status: 200 },
      );
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === "AbortError";
      const maybeCause = typeof error === "object" && error && "cause" in error ? (error as { cause?: { code?: string } }).cause : null;
      const code = maybeCause?.code || "";
      const connectivityCodes = new Set(["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EHOSTUNREACH"]);
      const suffix = connectivityCodes.has(code) ? ` (${code})` : "";
      attempts.push({
        baseUrl,
        status: isTimeout ? 504 : 503,
        detail: isTimeout ? "timeout" : `unreachable${suffix}`,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const first = attempts[0] || { status: 503, detail: "unreachable", baseUrl: config.baseUrl };
  return NextResponse.json(
    {
      ok: false,
      provider: "direct",
      engineMode: engineMode.mode,
      llmReachable: false,
      status: first.status,
      model: config.model,
      baseUrl: first.baseUrl,
      configuredBaseUrl: config.baseUrl,
      attemptedBaseUrls: candidates,
      message: `Nao foi possivel conectar ao LLM. Endpoints tentados: ${candidates.join(", ")}.`,
      attempts,
    },
    { status: first.status === 504 ? 504 : 503 },
  );
}


