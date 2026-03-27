import { loadVectorDatabaseConfig } from "../config/env";

const DEFAULT_INTERNAL_BASE_URL = "http://127.0.0.1:8000/v1";
const DEFAULT_LLM_MODEL = "mistral-awq";
const DEFAULT_EMBEDDING_MODEL = "mistral-awq";
const DEFAULT_EMBEDDING_TIMEOUT_MS = 30_000;
const DEFAULT_LLM_TIMEOUT_MS = 45_000;
const DEFAULT_LLM_RETRY_ATTEMPTS = 2;
const DEFAULT_LLM_RETRY_BACKOFF_MS = 250;
const DEFAULT_LLM_STRICT_CONTEXT_ONLY = false;
const DEFAULT_CONTEXT_MAX_CHARS = 18_000;
const DEFAULT_CONTEXT_MAX_CHUNKS = 20;
const DEFAULT_RESPONSE_MAX_TOKENS = 12_288;
const DEFAULT_RESPONSE_TEMPERATURE = 0;
const DEFAULT_RESPONSE_SEED = 42;
const DEFAULT_CHAT_HISTORY_MAX_MESSAGES = 16;
const DEFAULT_CHAT_HISTORY_MAX_CHARS = 20_000;
const DEFAULT_EMBEDDING_FAILURE_MODE = "degrade";

export type RagEmbeddingConfig = {
  baseUrl: string;
  fallbackBaseUrls: string[];
  apiKey: string;
  model: string;
  timeoutMs: number;
  expectedDimension: number;
  healthcheckPath: string;
  healthcheckCacheMs: number;
};

export type RagLlmConfig = {
  baseUrl: string;
  fallbackBaseUrls: string[];
  apiKey: string;
  model: string;
  timeoutMs: number;
  healthcheckPath: string;
  healthcheckCacheMs: number;
  retryAttempts: number;
  retryBackoffMs: number;
  requireInternalBaseUrl: boolean;
  hostOnly: boolean;
  strictContextOnly: boolean;
};

export type RagContextConfig = {
  maxChars: number;
  maxChunks: number;
};

export type RagGenerationConfig = {
  maxTokens: number;
  temperature: number;
  seed: number | null;
  historyMaxMessages: number;
  historyMaxChars: number;
};

export type RagEmbeddingFailureMode = "strict" | "degrade";

export type RagResilienceConfig = {
  embeddingFailureMode: RagEmbeddingFailureMode;
};

export type RagPipelineVersion = "v1" | "v2";

export type RagPipelineFlags = {
  pipelineVersion: RagPipelineVersion;
  hybridEnabled: boolean;
  rerankEnabled: boolean;
  citationAlignmentEnabled: boolean;
  writeModeEnabled: boolean;
  ocrAutoEnabled: boolean;
  mmrEnabled: boolean;
  retrievalRunAuditEnabled: boolean;
  generationRunAuditEnabled: boolean;
  cacheEnabled: boolean;
};

function pickFirstNonEmpty(...values: Array<string | undefined | null>) {
  for (const value of values) {
    const candidate = typeof value === "string" ? value.trim() : "";
    if (candidate) return candidate;
  }
  return "";
}

function parsePositiveInt(value: string | undefined, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function parseFiniteNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBaseUrl(value: string, fallback: string) {
  const selected = value || fallback;
  return selected.replace(/\/+$/, "");
}

function parseCsvUrls(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((item) => normalizeBaseUrl(item.trim(), ""))
    .filter(Boolean);
}

function uniqueUrls(urls: string[]) {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    const normalized = normalizeBaseUrl(url, "");
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function deriveLoopbackFallbacks(baseUrl: string) {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.hostname === "127.0.0.1") {
      parsed.hostname = "localhost";
      return [normalizeBaseUrl(parsed.toString(), "")];
    }
    if (parsed.hostname === "localhost") {
      parsed.hostname = "127.0.0.1";
      return [normalizeBaseUrl(parsed.toString(), "")];
    }
  } catch {
    // noop
  }
  return [];
}

function parseBooleanFlag(value: string | undefined, fallback: boolean) {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parseEmbeddingFailureMode(value: string | undefined) {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "strict") return "strict" as const;
  if (["degrade", "degraded", "fallback", "soft"].includes(normalized)) return "degrade" as const;
  return DEFAULT_EMBEDDING_FAILURE_MODE as RagEmbeddingFailureMode;
}

function parsePipelineVersion(value: string | undefined): RagPipelineVersion {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "v2") return "v2";
  return "v1";
}

function enforceLoopbackBaseUrl(baseUrl: string) {
  try {
    const parsed = new URL(baseUrl);
    const hostname = `${parsed.hostname || ""}`.trim().toLowerCase();
    if (hostname === "localhost") {
      parsed.hostname = "127.0.0.1";
    }
    return normalizeBaseUrl(parsed.toString(), DEFAULT_INTERNAL_BASE_URL);
  } catch {
    return normalizeBaseUrl(baseUrl, DEFAULT_INTERNAL_BASE_URL);
  }
}

export function loadRagEmbeddingConfig(raw: NodeJS.ProcessEnv = process.env): RagEmbeddingConfig {
  const vectorConfig = loadVectorDatabaseConfig(raw);
  const configuredBaseUrl = normalizeBaseUrl(
    pickFirstNonEmpty(raw.EMBEDDING_BASE_URL, raw.LOCAL_LLM_BASE_URL, raw.LLM_BASE_URL, raw.VLLM_BASE_URL),
    DEFAULT_INTERNAL_BASE_URL,
  );
  const envFallbacks = parseCsvUrls(raw.EMBEDDING_BASE_URL_FALLBACKS);
  const autoLoopbackFallbacks = deriveLoopbackFallbacks(configuredBaseUrl);
  const fallbackBaseUrls = uniqueUrls([...envFallbacks, ...autoLoopbackFallbacks]).filter(
    (url) => normalizeBaseUrl(url, "") !== configuredBaseUrl,
  );
  const apiKey = pickFirstNonEmpty(raw.EMBEDDING_API_KEY, raw.LOCAL_LLM_API_KEY, raw.LLM_API_KEY, raw.VLLM_API_KEY, "token-local");
  const model = pickFirstNonEmpty(
    raw.EMBEDDING_MODEL_NAME,
    raw.EMBEDDING_MODEL,
    raw.VLLM_EMBEDDING_MODEL,
    raw.LLM_MODEL_NAME,
    raw.VLLM_MODEL,
    DEFAULT_EMBEDDING_MODEL,
  );
  const timeoutMs = parsePositiveInt(raw.EMBEDDING_TIMEOUT_MS, DEFAULT_EMBEDDING_TIMEOUT_MS, 2_000, 120_000);
  const healthcheckPath = pickFirstNonEmpty(raw.EMBEDDING_HEALTHCHECK_PATH, "/health");
  const healthcheckCacheMs = parsePositiveInt(raw.EMBEDDING_HEALTHCHECK_CACHE_MS, 15_000, 1_000, 300_000);

  return {
    baseUrl: configuredBaseUrl,
    fallbackBaseUrls,
    apiKey,
    model,
    timeoutMs,
    expectedDimension: vectorConfig.embeddingDimension,
    healthcheckPath: healthcheckPath.startsWith("/") ? healthcheckPath : `/${healthcheckPath}`,
    healthcheckCacheMs,
  };
}

export function loadRagLlmConfig(raw: NodeJS.ProcessEnv = process.env): RagLlmConfig {
  const hostOnly = parseBooleanFlag(raw.RAG_LLM_HOST_ONLY, true);
  const resolvedBaseUrl = normalizeBaseUrl(
    pickFirstNonEmpty(raw.RAG_LLM_BASE_URL, raw.LOCAL_LLM_BASE_URL, raw.LLM_BASE_URL, raw.VLLM_BASE_URL),
    DEFAULT_INTERNAL_BASE_URL,
  );
  const configuredBaseUrl = hostOnly ? enforceLoopbackBaseUrl(resolvedBaseUrl) : resolvedBaseUrl;
  const envFallbacks = parseCsvUrls(raw.RAG_LLM_BASE_URL_FALLBACKS);
  const autoLoopbackFallbacks = deriveLoopbackFallbacks(configuredBaseUrl);
  const fallbackBaseUrls = hostOnly
    ? []
    : uniqueUrls([...envFallbacks, ...autoLoopbackFallbacks]).filter(
        (url) => normalizeBaseUrl(url, "") !== configuredBaseUrl,
      );
  const apiKey = pickFirstNonEmpty(raw.RAG_LLM_API_KEY, raw.LOCAL_LLM_API_KEY, raw.LLM_API_KEY, raw.VLLM_API_KEY, "token-local");
  const model = pickFirstNonEmpty(raw.RAG_LLM_MODEL_NAME, raw.LLM_MODEL_NAME, raw.VLLM_MODEL, DEFAULT_LLM_MODEL);
  const timeoutMs = parsePositiveInt(raw.RAG_LLM_TIMEOUT_MS, DEFAULT_LLM_TIMEOUT_MS, 3_000, 180_000);
  const healthcheckPath = pickFirstNonEmpty(raw.RAG_LLM_HEALTHCHECK_PATH, "/v1/models");
  const healthcheckCacheMs = parsePositiveInt(raw.RAG_LLM_HEALTHCHECK_CACHE_MS, 10_000, 1_000, 300_000);
  const retryAttempts = parsePositiveInt(raw.RAG_LLM_RETRY_ATTEMPTS, DEFAULT_LLM_RETRY_ATTEMPTS, 1, 5);
  const retryBackoffMs = parsePositiveInt(raw.RAG_LLM_RETRY_BACKOFF_MS, DEFAULT_LLM_RETRY_BACKOFF_MS, 50, 10_000);
  const requireInternalBaseUrl = parseBooleanFlag(raw.RAG_REQUIRE_INTERNAL_LLM_URL, true);
  const strictContextOnly = parseBooleanFlag(raw.RAG_LLM_STRICT_CONTEXT_ONLY, DEFAULT_LLM_STRICT_CONTEXT_ONLY);

  return {
    baseUrl: configuredBaseUrl,
    fallbackBaseUrls,
    apiKey,
    model,
    timeoutMs,
    healthcheckPath: healthcheckPath.startsWith("/") ? healthcheckPath : `/${healthcheckPath}`,
    healthcheckCacheMs,
    retryAttempts,
    retryBackoffMs,
    requireInternalBaseUrl,
    hostOnly,
    strictContextOnly,
  };
}

export function loadRagContextConfig(raw: NodeJS.ProcessEnv = process.env): RagContextConfig {
  const maxChars = parsePositiveInt(raw.RAG_CONTEXT_MAX_CHARS, DEFAULT_CONTEXT_MAX_CHARS, 256, 60_000);
  const maxChunks = parsePositiveInt(raw.RAG_CONTEXT_MAX_CHUNKS, DEFAULT_CONTEXT_MAX_CHUNKS, 1, 200);
  return { maxChars, maxChunks };
}

export function loadRagGenerationConfig(raw: NodeJS.ProcessEnv = process.env): RagGenerationConfig {
  const maxTokens = parsePositiveInt(raw.RAG_RESPONSE_MAX_TOKENS, DEFAULT_RESPONSE_MAX_TOKENS, 32, 65_536);
  const temperature = Math.max(0, Math.min(2, parseFiniteNumber(raw.RAG_RESPONSE_TEMPERATURE, DEFAULT_RESPONSE_TEMPERATURE)));
  const historyMaxMessages = parsePositiveInt(
    raw.RAG_CHAT_HISTORY_MAX_MESSAGES,
    DEFAULT_CHAT_HISTORY_MAX_MESSAGES,
    0,
    50,
  );
  const historyMaxChars = parsePositiveInt(raw.RAG_CHAT_HISTORY_MAX_CHARS, DEFAULT_CHAT_HISTORY_MAX_CHARS, 0, 40_000);
  const seedRaw = (raw.RAG_RESPONSE_SEED || "").trim().toLowerCase();
  let seed: number | null;
  if (!seedRaw) {
    seed = DEFAULT_RESPONSE_SEED;
  } else if (["none", "null", "off"].includes(seedRaw)) {
    seed = null;
  } else if (Number.isFinite(Number(seedRaw))) {
    seed = Math.trunc(Number(seedRaw));
  } else {
    seed = DEFAULT_RESPONSE_SEED;
  }

  return {
    maxTokens,
    temperature,
    seed,
    historyMaxMessages,
    historyMaxChars,
  };
}

export function loadRagResilienceConfig(raw: NodeJS.ProcessEnv = process.env): RagResilienceConfig {
  const embeddingFailureMode = parseEmbeddingFailureMode(raw.RAG_EMBEDDING_FAILURE_MODE);
  return { embeddingFailureMode };
}

export function loadRagPipelineFlags(raw: NodeJS.ProcessEnv = process.env): RagPipelineFlags {
  return {
    pipelineVersion: parsePipelineVersion(raw.PIPELINE_VERSION),
    hybridEnabled: parseBooleanFlag(raw.RAG_HYBRID_ENABLED, true),
    rerankEnabled: parseBooleanFlag(raw.RERANK_ENABLED, true),
    citationAlignmentEnabled: parseBooleanFlag(raw.CITATION_ALIGNMENT_ENABLED, true),
    writeModeEnabled: parseBooleanFlag(raw.WRITE_MODE_ENABLED, true),
    ocrAutoEnabled: parseBooleanFlag(raw.OCR_AUTO_ENABLED, true),
    mmrEnabled: parseBooleanFlag(raw.RAG_MMR_ENABLED, true),
    retrievalRunAuditEnabled: parseBooleanFlag(raw.RAG_RETRIEVAL_RUN_AUDIT_ENABLED, true),
    generationRunAuditEnabled: parseBooleanFlag(raw.RAG_GENERATION_RUN_AUDIT_ENABLED, true),
    cacheEnabled: parseBooleanFlag(raw.RAG_QUERY_CACHE_ENABLED, true),
  };
}
