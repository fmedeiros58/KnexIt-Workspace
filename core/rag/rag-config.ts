import { loadVectorDatabaseConfig } from "../config/env";

const DEFAULT_INTERNAL_BASE_URL = "http://127.0.0.1:8000/v1";
const DEFAULT_LLM_MODEL = "mistral-awq";
const DEFAULT_EMBEDDING_MODEL = "mistral-awq";
const DEFAULT_EMBEDDING_TIMEOUT_MS = 30_000;
const DEFAULT_LLM_TIMEOUT_MS = 45_000;
const DEFAULT_CONTEXT_MAX_CHARS = 9_000;
const DEFAULT_CONTEXT_MAX_CHUNKS = 12;
const DEFAULT_RESPONSE_MAX_TOKENS = 700;
const DEFAULT_RESPONSE_TEMPERATURE = 0;
const DEFAULT_RESPONSE_SEED = 42;
const DEFAULT_CHAT_HISTORY_MAX_MESSAGES = 8;
const DEFAULT_CHAT_HISTORY_MAX_CHARS = 5_000;

export type RagEmbeddingConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  expectedDimension: number;
};

export type RagLlmConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  requireInternalBaseUrl: boolean;
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

function parseBooleanFlag(value: string | undefined, fallback: boolean) {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export function loadRagEmbeddingConfig(raw: NodeJS.ProcessEnv = process.env): RagEmbeddingConfig {
  const vectorConfig = loadVectorDatabaseConfig(raw);
  const baseUrl = normalizeBaseUrl(
    pickFirstNonEmpty(raw.EMBEDDING_BASE_URL, raw.LOCAL_LLM_BASE_URL, raw.LLM_BASE_URL, raw.VLLM_BASE_URL),
    DEFAULT_INTERNAL_BASE_URL,
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

  return {
    baseUrl,
    apiKey,
    model,
    timeoutMs,
    expectedDimension: vectorConfig.embeddingDimension,
  };
}

export function loadRagLlmConfig(raw: NodeJS.ProcessEnv = process.env): RagLlmConfig {
  const baseUrl = normalizeBaseUrl(
    pickFirstNonEmpty(raw.RAG_LLM_BASE_URL, raw.LOCAL_LLM_BASE_URL, raw.LLM_BASE_URL, raw.VLLM_BASE_URL),
    DEFAULT_INTERNAL_BASE_URL,
  );
  const apiKey = pickFirstNonEmpty(raw.RAG_LLM_API_KEY, raw.LOCAL_LLM_API_KEY, raw.LLM_API_KEY, raw.VLLM_API_KEY, "token-local");
  const model = pickFirstNonEmpty(raw.RAG_LLM_MODEL_NAME, raw.LLM_MODEL_NAME, raw.VLLM_MODEL, DEFAULT_LLM_MODEL);
  const timeoutMs = parsePositiveInt(raw.RAG_LLM_TIMEOUT_MS, DEFAULT_LLM_TIMEOUT_MS, 3_000, 180_000);
  const requireInternalBaseUrl = parseBooleanFlag(raw.RAG_REQUIRE_INTERNAL_LLM_URL, true);

  return { baseUrl, apiKey, model, timeoutMs, requireInternalBaseUrl };
}

export function loadRagContextConfig(raw: NodeJS.ProcessEnv = process.env): RagContextConfig {
  const maxChars = parsePositiveInt(raw.RAG_CONTEXT_MAX_CHARS, DEFAULT_CONTEXT_MAX_CHARS, 256, 60_000);
  const maxChunks = parsePositiveInt(raw.RAG_CONTEXT_MAX_CHUNKS, DEFAULT_CONTEXT_MAX_CHUNKS, 1, 200);
  return { maxChars, maxChunks };
}

export function loadRagGenerationConfig(raw: NodeJS.ProcessEnv = process.env): RagGenerationConfig {
  const maxTokens = parsePositiveInt(raw.RAG_RESPONSE_MAX_TOKENS, DEFAULT_RESPONSE_MAX_TOKENS, 32, 8_192);
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
