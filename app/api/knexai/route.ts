import { NextRequest } from "next/server";
import { execFileSync } from "node:child_process";
import { createAssistantPipelineOrchestratorService } from "@/core/assistant/pipeline/pipeline-orchestrator.service";
import { LETICIA_SYSTEM_PROMPT } from "@/lib/knexai/spec";
import { loadPathConfig } from "@/core/config/paths";
import { resolveIdentityRuntimeSharedContext } from "@/core/identity/shared-memory-context";
import { createRagQueryService } from "@/core/rag/rag-query-service";
import { createRagInternetSearchService, type InternetSearchResponse } from "@/core/rag/internet-search-service";
import { RagPipelineError } from "@/core/rag/rag-errors";
import { toSseStream } from "@/core/rag/streaming-response";
import { readConfiguredAnmBaseUrl, resolveReachableAnmBaseUrl } from "@/app/api/_shared/anm-endpoint";
import {
  buildConversationStateSummaryBlock,
  injectConversationStatePrompt,
  rebuildConversationState,
} from "@/core/chat/perception/conversation-state.manager";
import { enforceResponseStructure } from "@/core/chat/perception/response-structure.enforcer";
import type { ConversationPerceptionState } from "@/core/chat/perception/types";

export const runtime = "nodejs";

const ragService = createRagQueryService();
const internetSearchService = createRagInternetSearchService();
const assistantOrchestrator = createAssistantPipelineOrchestratorService(ragService);


type ChatRole = "user" | "assistant";
type ChatHistoryItem = { role: ChatRole; content: string };
type ModelChatRole = "system" | "user" | "assistant";
type ModelChatMessage = { role: ModelChatRole; content: string };
type PromptComplexity = "micro" | "direct" | "short" | "medium" | "complex";
type SupportedLocale = "en-US" | "es-ES" | "pt-BR";
type GenerationProfile = {
  temperature: number;
  topP: number;
  maxTokens: number;
  repetitionPenalty: number;
  brevityInstruction: string;
};
type LlmConfig = {
  baseUrl: string;
  fallbackBaseUrls: string[];
  model: string;
  modelFallbacks: string[];
  apiKey: string;
  timeoutMs: number;
  contextWindow: number;
  maxTokens: number;
  hostOnly: boolean;
};
type EngineMode = "direct" | "anm";
type EngineModeConfig = {
  mode: EngineMode;
  anmBaseUrl: string;
  anmTimeoutMs: number;
  anmSoftTimeoutMs: number;
  fallbackToDirect: boolean;
};
type AnmChatResult = {
  answer: string;
  traceId: string | null;
};
type ResponsePolicyContext = {
  state: ConversationPerceptionState;
  complexity: PromptComplexity;
};
type AutoWebEvidence = {
  contextBlock: string;
  queryCount: number;
  resultCount: number;
  sources: string[];
};
type EngineAttempt<T> = {
  source: "anm" | "direct";
  ok: true;
  value: T;
} | {
  source: "anm" | "direct";
  ok: false;
  error: unknown;
};
type EngineHealthProbeResult = {
  ok: boolean;
  status: number;
  detail: string;
  checkedAt: number;
  baseUrl?: string;
  attemptedBaseUrls?: string[];
};

const DEFAULT_BASE_URL = "http://127.0.0.1:8000/v1";
const DEFAULT_MODEL = "mistral-awq";
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_TOKENS = 8_192;
const DEFAULT_CONTEXT_WINDOW = 8_192;
const CONTEXT_RESERVE_TOKENS = 256;
const AVAILABLE_MODELS_CACHE_TTL_MS = 30_000;
const ENGINE_HEALTH_CACHE_TTL_MS = Math.max(500, Number(process.env.KNEXAI_ENGINE_HEALTH_CACHE_TTL_MS || 3_000));
const ENGINE_HEALTH_TIMEOUT_MS = Math.max(200, Number(process.env.KNEXAI_ENGINE_HEALTH_TIMEOUT_MS || 1_500));
const WSL_DISCOVERY_CACHE_MS = 60_000;
const DEFAULT_ANM_BASE_URL = "http://127.0.0.1:8100";
const DEFAULT_ANM_TIMEOUT_MS = 45_000;
const DEFAULT_ANM_SOFT_TIMEOUT_MS = 200;

type AvailableModelsCache = {
  baseUrl: string;
  apiKey: string;
  expiresAt: number;
  models: string[];
};

let availableModelsCache: AvailableModelsCache | null = null;
let anmHealthProbeCache: { key: string; expiresAt: number; result: EngineHealthProbeResult } | null = null;
let llmHealthProbeCache: { key: string; expiresAt: number; result: EngineHealthProbeResult } | null = null;
let wslDiscoveryCache: { key: string; checkedAt: number; urls: string[] } | null = null;

function pickFirstNonEmpty(...values: Array<string | undefined | null>) {
  for (const value of values) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) return trimmed;
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

function parseOptionalBoolean(value: string | undefined | null): boolean | undefined {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
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

function enforceLoopbackBaseUrl(baseUrl: string) {
  try {
    const parsed = new URL(baseUrl);
    const hostname = `${parsed.hostname || ""}`.trim().toLowerCase();
    if (hostname === "localhost") {
      parsed.hostname = "127.0.0.1";
    }
    return normalizeUrl(parsed.toString());
  } catch {
    return normalizeUrl(baseUrl);
  }
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

function normalizeTemporalPrompt(prompt: string) {
  return prompt
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[!?.,;:"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCurrentDatePrompt(prompt: string) {
  const normalized = normalizeTemporalPrompt(prompt);
  if (!normalized) return false;
  const patterns = [
    /\b(qual|que)\s+(e|eh)\s+(o\s+)?(dia|data)\s+de\s+hoje\b/,
    /\bqual\s+(o\s+)?(dia|data)\s+de\s+hoje\b/,
    /\bme\s+diga\s+(o\s+)?(dia|data)\s+de\s+hoje\b/,
    /\bque\s+dia\s+(e|eh)\s+hoje\b/,
    /\bhoje\s+(e|eh)\s+que\s+dia\b/,
    /\bwhat\s+day\s+is\s+it\s+today\b/,
    /\bwhat\s+is\s+todays?\s+date\b/,
    /\btodays?\s+date\b/,
  ];
  return patterns.some((pattern) => pattern.test(normalized));
}

function buildCurrentDateContext() {
  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const locale = "pt-BR";
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone }).format(now);
  const date = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "long", year: "numeric", timeZone }).format(now);
  return {
    weekday,
    date,
    timeZone,
    line: `Data atual de referencia: ${weekday}, ${date} (fuso ${timeZone}).`,
  };
}

function buildCurrentDateAnswer() {
  const current = buildCurrentDateContext();
  return `Hoje e ${current.weekday}, ${current.date}. (Fuso: ${current.timeZone})`;
}

function buildWebVerificationUnavailableAnswer(localeHint: string) {
  const normalized = `${localeHint || ""}`.trim().toLowerCase();
  if (normalized.startsWith("en")) {
    return "I could not validate this fact with web sources in this turn. To avoid outdated information, I need to rerun multi-source verification before confirming it.";
  }
  if (normalized.startsWith("es")) {
    return "No pude validar este dato con fuentes web en este turno. Para evitar informacion desactualizada, necesito repetir la verificacion multifuente antes de confirmarlo.";
  }
  return "Nao consegui validar esse fato em fontes web neste turno. Para evitar informacao desatualizada, preciso repetir a verificacao multifonte antes de confirmar.";
}

function normalizeForVerification(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isVerifiableQuestionForAutoSearch(prompt: string) {
  const normalized = normalizeForVerification(prompt);
  if (!normalized) return false;
  const asksCurrentOffice =
    /\b(reitor|reitora|presidente|prefeito|governador|ministro|secretario|diretor|ceo|rector|chancellor)\b/.test(
      normalized,
    ) && /\b(quem|who|qual|nome|current|atual|hoje|agora)\b/.test(normalized);
  const asksVerifiableData =
    /\b(data|ano|numero|percentual|taxa|fonte|citacao|referencia|lei|norma|resolucao|preco|valor|dosagem|dose|mg|ml)\b/.test(
      normalized,
    );
  return asksCurrentOffice || asksVerifiableData;
}

function dedupeUrls(results: Array<InternetSearchResponse["results"][number]>, maxItems: number) {
  const unique: Array<InternetSearchResponse["results"][number]> = [];
  const seen = new Set<string>();
  for (const row of results) {
    const url = `${row.url || ""}`.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    unique.push(row);
    if (unique.length >= maxItems) break;
  }
  return unique;
}

function buildAutoSearchQueries(prompt: string) {
  const base = `${prompt || ""}`.trim();
  if (!base) return [];
  const maxQueries = Number.isFinite(Number(process.env.KNEXAI_AUTO_WEB_SEARCH_QUERIES))
    ? Math.max(1, Math.min(5, Math.trunc(Number(process.env.KNEXAI_AUTO_WEB_SEARCH_QUERIES))))
    : 3;
  const candidates = [base, `${base} site:gov.br`, `${base} site:wikipedia.org`, `${base} atualizado`];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const query of candidates) {
    const normalized = query.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(query.trim());
    if (unique.length >= maxQueries) break;
  }
  return unique;
}

async function buildAutomaticWebEvidence(prompt: string): Promise<AutoWebEvidence | null> {
  const autoEnabled = parseOptionalBoolean(process.env.KNEXAI_AUTO_WEB_SEARCH_ENABLED) !== false;
  const forceMultiSource = parseOptionalBoolean(process.env.KNEXAI_FORCE_MULTI_SOURCE_WEB_SEARCH) !== false;
  if (!autoEnabled) return null;
  if (!internetSearchService.isEnabled()) return null;
  if (!forceMultiSource && !isVerifiableQuestionForAutoSearch(prompt)) return null;

  const queries = buildAutoSearchQueries(prompt);
  if (!queries.length) return null;

  const allResults: Array<InternetSearchResponse["results"][number]> = [];
  for (const query of queries) {
    try {
      const payload = await internetSearchService.search({ query, preferPdf: false });
      if (!payload || !Array.isArray(payload.results) || !payload.results.length) continue;
      allResults.push(...payload.results);
    } catch (error) {
      console.warn("KNEXAI_AUTO_WEB_SEARCH_QUERY_FAILED", {
        query,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (!allResults.length) {
    if (!forceMultiSource) return null;
    const missingBlock = [
      "[WEB_VERIFIED_CONTEXT]",
      `Pergunta: ${prompt.trim()}`,
      "Consultas executadas: 0",
      "Status: nenhuma fonte web recuperada neste turno.",
      "Regra: nao responder fato verificavel por memoria; informar falha de verificacao web e solicitar nova tentativa.",
      "[/WEB_VERIFIED_CONTEXT]",
    ].join("\n");
    return {
      contextBlock: missingBlock,
      queryCount: 0,
      resultCount: 0,
      sources: [],
    };
  }

  const maxResults = Number.isFinite(Number(process.env.KNEXAI_AUTO_WEB_SEARCH_MAX_RESULTS))
    ? Math.max(2, Math.min(12, Math.trunc(Number(process.env.KNEXAI_AUTO_WEB_SEARCH_MAX_RESULTS))))
    : 8;
  const selected = dedupeUrls(allResults, maxResults);
  if (!selected.length) return null;

  const lines: string[] = [];
  lines.push("[WEB_VERIFIED_CONTEXT]");
  lines.push(`Pergunta: ${prompt.trim()}`);
  lines.push(`Consultas executadas: ${queries.length}`);
  selected.forEach((row, index) => {
    const title = `${row.title || `Fonte ${index + 1}`}`.trim();
    const snippet = `${row.snippet || ""}`.trim();
    lines.push(`${index + 1}. ${title}`);
    lines.push(`URL: ${row.url}`);
    if (snippet) lines.push(`Trecho: ${snippet}`);
  });
  lines.push("[/WEB_VERIFIED_CONTEXT]");

  return {
    contextBlock: lines.join("\n"),
    queryCount: queries.length,
    resultCount: selected.length,
    sources: selected.map((row) => `${row.url || ""}`.trim()).filter(Boolean),
  };
}

function resolveLogicalModelName() {
  const explicit = pickFirstNonEmpty(process.env.LLM_MODEL_NAME);
  if (explicit) return explicit;

  const legacy = pickFirstNonEmpty(process.env.VLLM_MODEL);
  // VLLM_MODEL historicamente pode receber caminho de disco. No payload OpenAI-like, usar nome logico.
  if (legacy && !legacy.includes("/") && !legacy.includes("\\")) return legacy;

  return DEFAULT_MODEL;
}

function resolveModelFallbacks(primaryModel: string) {
  const pathConfig = loadPathConfig();
  const localModelPath = pickFirstNonEmpty(process.env.LOCAL_LLM_MODEL, pathConfig.localLlmModelDefaultPath);
  const localModelPathBasename = localModelPath.replace(/\\/g, "/").split("/").filter(Boolean).pop() || "";
  const candidates = [
    pickFirstNonEmpty(process.env.VLLM_MODEL),
    localModelPath,
    localModelPathBasename,
    pathConfig.localLlmModelDefaultPath,
  ]
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(candidates)).filter((value) => value !== primaryModel);
}

class LlmRouteError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function readLlmConfig(): LlmConfig {
  const hostOnly = parseBooleanFlag(process.env.KNEXAI_LLM_HOST_ONLY, true);
  const resolvedBaseUrl = normalizeUrl(
    pickFirstNonEmpty(process.env.LOCAL_LLM_BASE_URL, process.env.LLM_BASE_URL, process.env.VLLM_BASE_URL, DEFAULT_BASE_URL),
  );
  const baseUrl = hostOnly ? enforceLoopbackBaseUrl(resolvedBaseUrl) : resolvedBaseUrl;
  const fallbackBaseUrls = hostOnly
    ? []
    : parseBaseUrlList(
    pickFirstNonEmpty(
      process.env.KNEXAI_LLM_FALLBACK_BASE_URLS,
      process.env.LOCAL_LLM_FALLBACK_BASE_URLS,
      process.env.LLM_FALLBACK_BASE_URLS,
      "",
    ),
  ).filter((item) => item !== baseUrl);
  const model = resolveLogicalModelName();
  const modelFallbacks = resolveModelFallbacks(model);
  const apiKey = pickFirstNonEmpty(process.env.LOCAL_LLM_API_KEY, process.env.VLLM_API_KEY, process.env.LLM_API_KEY, "token-local");
  const parsedTimeout = Number(process.env.LLM_TIMEOUT_MS || process.env.VLLM_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(parsedTimeout) ? Math.max(3_000, parsedTimeout) : DEFAULT_TIMEOUT_MS;
  const parsedContextWindow = Number(process.env.LLM_CONTEXT_WINDOW || process.env.VLLM_CONTEXT_WINDOW || DEFAULT_CONTEXT_WINDOW);
  const contextWindow = Number.isFinite(parsedContextWindow) ? Math.max(512, Math.round(parsedContextWindow)) : DEFAULT_CONTEXT_WINDOW;
  const parsedMaxTokens = Number(process.env.LLM_MAX_TOKENS || process.env.VLLM_MAX_TOKENS || DEFAULT_MAX_TOKENS);
  const requestedMaxTokens = Number.isFinite(parsedMaxTokens) ? Math.max(64, Math.round(parsedMaxTokens)) : DEFAULT_MAX_TOKENS;
  const maxByContext = Math.max(64, contextWindow - CONTEXT_RESERVE_TOKENS);
  const maxTokens = Math.min(requestedMaxTokens, maxByContext);
  return { baseUrl, fallbackBaseUrls, model, modelFallbacks, apiKey, timeoutMs, contextWindow, maxTokens, hostOnly };
}

function readEngineModeConfig(): EngineModeConfig {
  const modeRaw = pickFirstNonEmpty(process.env.KNEXAI_ENGINE_MODE, "direct").toLowerCase();
  const mode: EngineMode = modeRaw === "anm" ? "anm" : "direct";
  const anmBaseUrl = readConfiguredAnmBaseUrl(pickFirstNonEmpty(process.env.ANM_BACKEND_BASE_URL, DEFAULT_ANM_BASE_URL));
  const parsedAnmTimeout = Number(process.env.ANM_BACKEND_TIMEOUT_MS || DEFAULT_ANM_TIMEOUT_MS);
  const anmTimeoutMs = Number.isFinite(parsedAnmTimeout) ? Math.max(3_000, Math.round(parsedAnmTimeout)) : DEFAULT_ANM_TIMEOUT_MS;
  const parsedAnmSoftTimeout = Number(process.env.KNEXAI_ANM_SOFT_TIMEOUT_MS || DEFAULT_ANM_SOFT_TIMEOUT_MS);
  const anmSoftTimeoutMs = Number.isFinite(parsedAnmSoftTimeout)
    ? Math.max(200, Math.min(anmTimeoutMs, Math.round(parsedAnmSoftTimeout)))
    : DEFAULT_ANM_SOFT_TIMEOUT_MS;
  const fallbackRaw = pickFirstNonEmpty(process.env.KNEXAI_ANM_FALLBACK_TO_DIRECT, "1").toLowerCase();
  const fallbackToDirect = !["0", "false", "no", "off"].includes(fallbackRaw);
  return { mode, anmBaseUrl, anmTimeoutMs, anmSoftTimeoutMs, fallbackToDirect };
}

function resolveDynamicLlmFallbackUrls(seedUrls: string[]) {
  if (parseBooleanFlag(process.env.KNEXAI_LLM_HOST_ONLY, true)) return [];
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
  if (urls.length) {
    console.info("KNEXAI_DYNAMIC_LLM_FALLBACKS", {
      discoveredHosts,
      dynamicUrls: urls,
    });
  }
  return urls;
}

function resolveLlmBaseUrlCandidates(config: LlmConfig) {
  if (config.hostOnly) {
    return [normalizeUrl(config.baseUrl)];
  }
  const seedUrls = [
    normalizeUrl(config.baseUrl),
    ...config.fallbackBaseUrls.map((item) => normalizeUrl(item)),
  ];
  const dynamicFallbacks = resolveDynamicLlmFallbackUrls(seedUrls);
  const ordered = [...seedUrls, ...dynamicFallbacks];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const candidate of ordered) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    result.push(candidate);
  }
  return result;
}

function applyResolvedLlmBaseUrl(config: LlmConfig, baseUrl: string | null | undefined) {
  const normalized = normalizeUrl(baseUrl || "");
  if (!normalized || normalized === config.baseUrl) return config;
  return { ...config, baseUrl: normalized };
}

function safeBackendError(status: number, code: string, message: string) {
  return Response.json({ code, message }, { status });
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function describeEngineError(error: unknown) {
  if (error instanceof LlmRouteError) return `${error.code}: ${error.message}`;
  if (error instanceof Error) return error.message;
  return String(error);
}

function toAttemptOk<T>(source: "anm" | "direct", value: T): EngineAttempt<T> {
  return { source, ok: true, value };
}

function toAttemptError(source: "anm" | "direct", error: unknown): EngineAttempt<never> {
  return { source, ok: false, error };
}

async function probeEngineHealth(input: {
  url: string;
  timeoutMs: number;
  headers?: Record<string, string>;
}): Promise<EngineHealthProbeResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.max(200, input.timeoutMs));
  const checkedAt = Date.now();
  try {
    const response = await fetch(input.url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: input.headers || {},
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        detail: `HTTP_${response.status}`,
        checkedAt,
      };
    }
    const contentType = `${response.headers.get("content-type") || ""}`.toLowerCase();
    if (contentType.includes("application/json")) {
      try {
        const payload = (await response.json()) as { ok?: unknown; detail?: unknown; error?: unknown };
        if (payload && payload.ok === false) {
          const detail = typeof payload.detail === "string" ? payload.detail : typeof payload.error === "string" ? payload.error : "ok_false";
          return {
            ok: false,
            status: response.status,
            detail,
            checkedAt,
          };
        }
      } catch {
        // Ignore JSON parse issues in health probe and keep status-based success.
      }
    }
    return {
      ok: true,
      status: response.status,
      detail: "ok",
      checkedAt,
    };
  } catch (error) {
    return {
      ok: false,
      status: isAbortError(error) ? 504 : 0,
      detail: isAbortError(error) ? "timeout" : describeEngineError(error),
      checkedAt,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function probeAnmHealth(config: EngineModeConfig): Promise<EngineHealthProbeResult> {
  const key = `${config.anmBaseUrl}`;
  const now = Date.now();
  if (anmHealthProbeCache && anmHealthProbeCache.key === key && anmHealthProbeCache.expiresAt > now) {
    return anmHealthProbeCache.result;
  }
  const result = await probeEngineHealth({
    url: `${config.anmBaseUrl}/healthz`,
    timeoutMs: Math.min(config.anmSoftTimeoutMs, ENGINE_HEALTH_TIMEOUT_MS),
  });
  anmHealthProbeCache = {
    key,
    expiresAt: now + ENGINE_HEALTH_CACHE_TTL_MS,
    result,
  };
  return result;
}

async function probeDirectHealth(config: LlmConfig): Promise<EngineHealthProbeResult> {
  const candidates = resolveLlmBaseUrlCandidates(config);
  const key = `${candidates.join("|")}|${config.apiKey}`;
  const now = Date.now();
  if (llmHealthProbeCache && llmHealthProbeCache.key === key && llmHealthProbeCache.expiresAt > now) {
    return llmHealthProbeCache.result;
  }

  let firstFailure: EngineHealthProbeResult | null = null;
  for (const baseUrl of candidates) {
    const result = await probeEngineHealth({
      url: `${baseUrl}/models`,
      timeoutMs: Math.min(config.timeoutMs, ENGINE_HEALTH_TIMEOUT_MS),
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    const decorated: EngineHealthProbeResult = {
      ...result,
      baseUrl,
      attemptedBaseUrls: candidates,
    };
    if (decorated.ok) {
      if (baseUrl !== config.baseUrl) {
        console.warn("KNEXAI_LLM_BASEURL_FAILOVER", {
          configuredBaseUrl: config.baseUrl,
          selectedBaseUrl: baseUrl,
          attemptedBaseUrls: candidates,
        });
      }
      llmHealthProbeCache = {
        key,
        expiresAt: now + ENGINE_HEALTH_CACHE_TTL_MS,
        result: decorated,
      };
      return decorated;
    }
    if (!firstFailure) firstFailure = decorated;
  }

  const result = firstFailure || {
    ok: false,
    status: 503,
    detail: "unreachable",
    checkedAt: now,
    baseUrl: config.baseUrl,
    attemptedBaseUrls: candidates,
  };
  llmHealthProbeCache = {
    key,
    expiresAt: now + ENGINE_HEALTH_CACHE_TTL_MS,
    result,
  };
  return result;
}

function buildEngineCompositeError(attempts: Array<EngineAttempt<unknown>>) {
  const failed = attempts.filter((attempt) => !attempt.ok);
  const summary = failed
    .map((attempt) =>
      `${attempt.source.toUpperCase()}=${describeEngineError("error" in attempt ? attempt.error : "unknown_error")}`,
    )
    .join(" | ");
  return new LlmRouteError(
    503,
    "ENGINE_PATHS_UNAVAILABLE",
    summary ? `Todos os caminhos de inferencia falharam. ${summary}` : "Todos os caminhos de inferencia falharam.",
  );
}

function stripConversationRoleArtifacts(text: string) {
  let output = `${text || ""}`.trim();
  if (!output) return "";
  output = output.replace(/^\s*(?:leticia|l\.e\.t\.i\.c\.i\.a|assistente|assistant|resposta|answer)\s*[:：-]\s*/i, "");
  const markerIndex = output.search(/\b(?:usuario|user|assistente|assistant)\s*[:：]/i);
  if (markerIndex >= 0) {
    output = output.slice(0, markerIndex).trim();
  }
  output = output.replace(/\n{3,}/g, "\n\n").trim();
  return output;
}

function toAnmTextResponse(anm: AnmChatResult, policyContext: ResponsePolicyContext) {
  const cleaned = stripConversationRoleArtifacts(anm.answer);
  const enforcedAnswer = enforceResponseStructure(cleaned || anm.answer, {
    state: policyContext.state,
    complexity: policyContext.complexity,
  });
  const headers: Record<string, string> = { "Content-Type": "text/plain; charset=utf-8" };
  if (anm.traceId) headers["X-KnexAI-Trace-Id"] = anm.traceId;
  return new Response(createChunkedTextStream(enforcedAnswer || cleaned || anm.answer), {
    status: 200,
    headers,
  });
}

function normalizeHistory(value: unknown): ChatHistoryItem[] {
  if (!Array.isArray(value)) return [];
  const items: ChatHistoryItem[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const role = (candidate as { role?: unknown }).role;
    const content = (candidate as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const trimmed = content.trim();
    if (!trimmed) continue;
    items.push({ role, content: trimmed });
  }
  // Mantem uma janela maior para preservar continuidade semantica entre turnos.
  return items.slice(-16);
}

function parseOptionalBooleanFromBody(value: unknown) {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return undefined;
}

function parseOptionalFiniteNumberFromBody(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalPositiveIntFromBody(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const rounded = Math.round(parsed);
  return rounded > 0 ? rounded : undefined;
}

function parseOptionalPositiveIntArrayFromBody(value: unknown, maxItems = 64) {
  if (!Array.isArray(value)) return undefined;
  const normalized: number[] = [];
  const seen = new Set<number>();
  for (const raw of value) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) continue;
    const rounded = Math.round(parsed);
    if (rounded <= 0 || seen.has(rounded)) continue;
    seen.add(rounded);
    normalized.push(rounded);
    if (normalized.length >= maxItems) break;
  }
  return normalized.length ? normalized : undefined;
}

function parseStreamModeFromBody(value: unknown): "" | "sse" | "plain" {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase();
  if (normalized === "sse" || normalized === "plain") return normalized;
  return "";
}

function parsePipelineVersionFromBody(value: unknown): "v1" | "v2" | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "v1" || normalized === "v2") return normalized;
  return undefined;
}

function parseOptionalEngineModeFromBody(value: unknown): EngineMode | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "direct" || normalized === "anm") return normalized;
  return undefined;
}

function parseOptionalLanguageIdFromBody(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 32);
}

function buildAttachmentsFromComposer(
  composerAttachmentIds: number[] | undefined,
  scopedDocumentIds: number[] | undefined,
) {
  const ids = (composerAttachmentIds && composerAttachmentIds.length ? composerAttachmentIds : scopedDocumentIds) || [];
  return ids.map((id) => ({ id: `${id}`, kind: "file" as const, name: `documento-${id}` }));
}

function normalizeRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function sanitizeHistoryForModel(history: ChatHistoryItem[]): ChatHistoryItem[] {
  const sanitized: ChatHistoryItem[] = [];
  for (const item of history) {
    const content = item.content.trim();
    if (!content) continue;

    // Alguns templates exigem que o historico comecem por "user".
    if (!sanitized.length && item.role === "assistant") continue;

    const last = sanitized[sanitized.length - 1];
    if (!last) {
      sanitized.push({ role: item.role, content });
      continue;
    }

    // Consolida papeis repetidos para manter alternancia user/assistant.
    if (last.role === item.role) {
      last.content = `${last.content}\n${content}`.trim();
      continue;
    }

    sanitized.push({ role: item.role, content });
  }

  return sanitized;
}

function ensurePrompt(history: ChatHistoryItem[], prompt: string): ChatHistoryItem[] {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) return history;
  const last = history[history.length - 1];
  if (last?.role === "user" && last.content === trimmedPrompt) return history;
  return [...history, { role: "user", content: trimmedPrompt }];
}

function resolveEffectiveHistory(history: ChatHistoryItem[], prompt: string): ChatHistoryItem[] {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) return history;

  // Saudacoes/encerramentos devem ser tratados como turno atual isolado para evitar deriva para tema antigo.
  if (isMicroSocialPrompt(trimmedPrompt)) {
    return [{ role: "user", content: trimmedPrompt }];
  }

  return history;
}

function truncateHistoryContent(content: string, maxChars: number) {
  const normalized = content.trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(32, maxChars - 3)).trimEnd()}...`;
}

function optimizeHistoryForLatency(history: ChatHistoryItem[], prompt: string): ChatHistoryItem[] {
  if (!history.length) return history;
  const complexity = classifyPromptComplexity(prompt);
  const last = history[history.length - 1];
  if (!last) return history;

  if (complexity === "micro") {
    return [{ role: "user", content: truncateHistoryContent(last.content, 320) }];
  }

  const limitsByComplexity: Record<PromptComplexity, { maxItems: number; charBudget: number; maxPerMessage: number; maxLast: number }> = {
    micro: { maxItems: 1, charBudget: 0, maxPerMessage: 320, maxLast: 320 },
    direct: { maxItems: 5, charBudget: 1400, maxPerMessage: 550, maxLast: 700 },
    short: { maxItems: 8, charBudget: 2400, maxPerMessage: 760, maxLast: 900 },
    medium: { maxItems: 10, charBudget: 3800, maxPerMessage: 1000, maxLast: 1200 },
    complex: { maxItems: 12, charBudget: 5600, maxPerMessage: 1400, maxLast: 1600 },
  };
  const limits = limitsByComplexity[complexity];
  const previous = history.slice(0, -1);
  const selectedReversed: ChatHistoryItem[] = [];
  let usedChars = 0;

  for (let idx = previous.length - 1; idx >= 0; idx -= 1) {
    if (selectedReversed.length >= Math.max(0, limits.maxItems - 1)) break;
    const item = previous[idx];
    const compact = truncateHistoryContent(item.content, limits.maxPerMessage);
    if (!compact) continue;
    if (usedChars + compact.length > limits.charBudget) break;
    usedChars += compact.length;
    selectedReversed.push({ role: item.role, content: compact });
  }

  selectedReversed.reverse();
  return [...selectedReversed, { role: last.role, content: truncateHistoryContent(last.content, limits.maxLast) }];
}

function isShortPrompt(prompt: string) {
  const normalized = prompt.trim();
  if (!normalized) return true;
  const words = normalized.split(/\s+/).filter(Boolean);
  return normalized.length <= 90 && words.length <= 16;
}

function isMicroSocialPrompt(prompt: string): boolean {
  const normalized = prompt.trim();
  if (!normalized) return false;

  const lowered = normalized.toLowerCase();
  const compact = lowered
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[!?.,;:"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = compact.split(" ").filter(Boolean);
  if (words.length > 8 || normalized.length > 60) return false;

  const microSocialPatterns = [
    /^(oi|ola|ol[a�]|oie|oii|e ai|eae|opa|hey|hello|hi)$/i,
    /^(bom dia|boa tarde|boa noite)$/i,
    /^(blz|beleza|tudo bem|td bem|como vai|como vc esta|como voce esta|how are you|que tal)$/i,
    /^(nada por agora|nada agora|de boa|tranquilo|ok|okay|ok obrigado|obrigado|obg|valeu)$/i,
    /^(ate logo|at[e�] logo|ate mais|at[e�] mais|tchau|falou|ate breve|at[e�] breve|bye)$/i,
  ];

  return microSocialPatterns.some((pattern) => pattern.test(compact));
}

function classifyPromptComplexity(prompt: string): PromptComplexity {
  const normalized = prompt.trim();
  if (!normalized) return "short";
  if (isMicroSocialPrompt(normalized)) return "micro";

  const lowered = normalized.toLowerCase();
  const words = normalized.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const charCount = normalized.length;

  const directIntentPatterns = [
    /\b(sin[oô]nimo|sinonimo|sin[oô]nimos|sinonimos|ant[oô]nimo|antonimo|ant[oô]nimos|antonimos)\b/i,
    /\b(traduz|traduza|tradu[cç][aã]o|translation)\b/i,
    /\b(defina|defini[cç][aã]o|o que significa|significa)\b/i,
    /\b(corrija|corre[cç][aã]o|ortografia|gram[áa]tica)\b/i,
    /\b(responda em uma frase|responda curto|resuma em uma frase|bem curto)\b/i,
  ];
  const directIntent = directIntentPatterns.some((pattern) => pattern.test(normalized));
  if (directIntent && wordCount <= 24) return "direct";

  const complexSignals = [
    "explique em detalhes",
    "detalhe",
    "aprofunde",
    "analise",
    "compare",
    "passo a passo",
    "arquitetura",
    "estrategia",
    "estratégia",
    "plano",
    "trade-off",
    "vantagens e desvantagens",
    "como funciona",
    "por que",
    "porque",
  ];
  const hasComplexSignal = complexSignals.some((signal) => lowered.includes(signal));
  if (hasComplexSignal || wordCount >= 45 || charCount >= 260) return "complex";

  if (wordCount <= 6 && !hasComplexSignal) return "direct";
  if (isShortPrompt(normalized)) return "short";
  return "medium";
}

function resolveGenerationProfile(prompt: string, config: LlmConfig): GenerationProfile {
  const complexity = classifyPromptComplexity(prompt);

  if (complexity === "micro") {
    return {
      temperature: 0.08,
      topP: 0.72,
      maxTokens: Math.min(config.maxTokens, 40),
      repetitionPenalty: 1.2,
      brevityInstruction:
        "Interacao social minima: responda em 1 frase curtissima (ate 12 palavras), sem convite extra e sem prolongar conversa.",
    };
  }

  if (complexity === "direct") {
    return {
      temperature: 0.12,
      topP: 0.8,
      maxTokens: Math.min(config.maxTokens, 256),
      repetitionPenalty: 1.12,
      brevityInstruction:
        "Resposta objetiva e pontual: va direto ao ponto em 1 paragrafo curto ou ate 2 frases encadeadas, sem fragmentacao.",
    };
  }

  if (complexity === "short") {
    return {
      temperature: 0.2,
      topP: 0.85,
      maxTokens: Math.min(config.maxTokens, 768),
      repetitionPenalty: 1.16,
      brevityInstruction:
        "Resposta curta e direta: use 1 paragrafo fluido (ate 4 frases), sem listas quebradas e sem repeticao desnecessaria.",
    };
  }

  if (complexity === "medium") {
    return {
      temperature: 0.28,
      topP: 0.9,
      maxTokens: Math.min(config.maxTokens, 2048),
      repetitionPenalty: 1.1,
      brevityInstruction:
        "Resposta equilibrada: explique com clareza em 1 a 3 paragrafos coesos e densos, mantendo continuidade com o turno anterior.",
    };
  }

  return {
    temperature: 0.32,
    topP: 0.92,
    maxTokens: config.maxTokens,
    repetitionPenalty: 1.08,
    brevityInstruction:
      "Resposta aprofundada e estruturada: traga contexto, explicacao tecnica, trade-offs e conclusao em paragrafos articulados e sem fragmentacao.",
  };
}

function buildSystemInstruction(profile: GenerationProfile, conversationStateBlock = "") {
  const currentDate = buildCurrentDateContext();
  const lines = [
    LETICIA_SYSTEM_PROMPT.trim(),
    "",
    currentDate.line,
    "Para perguntas com termos relativos (hoje, amanha, ontem), use essa data de referencia.",
    "",
    "Regras criticas desta resposta:",
    "- Responda a intencao mais recente do usuario (pergunta, saudacao, ajuste ou comando).",
    "- Trate a mensagem atual como continuacao preferencial do fluxo em andamento, salvo mudanca explicita de assunto.",
    "- Preserve tema principal, tarefa ativa e objeto textual em curso antes de responder.",
    "- Use historico recente para manter continuidade semantica e nao reiniciar o raciocinio sem necessidade.",
    "- Nao invente fatos, termos tecnicos, ingredientes, nomes ou numeros.",
    "- Se houver incerteza factual, diga explicitamente que nao tem certeza.",
    "- Evite respostas picotadas: priorize paragrafos completos, articulados e com fechamento coerente.",
    "",
    `Diretriz de estilo: ${profile.brevityInstruction}`,
  ];
  if (conversationStateBlock.trim()) {
    lines.push("");
    lines.push("Estado conversacional consolidado:");
    lines.push(conversationStateBlock.trim());
  }
  return lines.join("\n");
}

function resolveMicroSocialLocale(prompt: string): SupportedLocale {
  const lowered = prompt.toLowerCase();
  if (/\b(hello|hi|hey|thanks|thank you|bye)\b/i.test(lowered)) return "en-US";
  if (/\b(hola|gracias|adios)\b/i.test(lowered)) return "es-ES";
  return "pt-BR";
}

function buildMicroSocialAnswer(prompt: string) {
  const compact = prompt
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[!?.,;:"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const locale = resolveMicroSocialLocale(prompt);

  if (/^(como vc esta|como voce esta|como vai|how are you|tudo bem|td bem|que tal)$/.test(compact)) {
    if (locale === "en-US") return "I am doing well and ready to help. What do you want to do next?";
    if (locale === "es-ES") return "Estoy bien y lista para ayudar. Que quieres hacer ahora?";
    return "Estou bem e pronta para ajudar. O que voce quer fazer agora?";
  }

  if (/^(tchau|falou|ate mais|ate logo|bye|adios)$/.test(compact)) {
    if (locale === "en-US") return "See you! If you need anything else, I am here.";
    if (locale === "es-ES") return "Hasta luego. Si necesitas algo mas, aqui estoy.";
    return "Ate mais. Se precisar de algo, estou aqui.";
  }
  if (/^(obrigado|obg|valeu|thanks|thank you|gracias)$/.test(compact)) {
    if (locale === "en-US") return "You are welcome. I am ready for the next step.";
    if (locale === "es-ES") return "De nada. Estoy lista para el siguiente paso.";
    return "De nada. Estou pronta para o proximo passo.";
  }
  if (locale === "en-US") return "Hi. How can I help you right now?";
  if (locale === "es-ES") return "Hola. Como puedo ayudarte ahora?";
  return "Oi. Como posso te ajudar agora?";
}

function shouldUseSystemRoleForChatCompletions() {
  const raw = pickFirstNonEmpty(process.env.KNEXAI_CHAT_USE_SYSTEM_ROLE, "0").toLowerCase();
  return ["1", "true", "yes", "on"].includes(raw);
}

function buildChatMessages(
  history: ChatHistoryItem[],
  profile: GenerationProfile,
  conversationStateBlock = "",
): ModelChatMessage[] {
  if (!history.length) return [];
  if (shouldUseSystemRoleForChatCompletions()) {
    return [{ role: "system", content: buildSystemInstruction(profile, conversationStateBlock) }, ...history];
  }

  const injected = history.map((item) => ({ ...item }));
  const firstUserIndex = injected.findIndex((row) => row.role === "user");
  if (firstUserIndex >= 0) {
    const firstUser = injected[firstUserIndex];
    firstUser.content = `${buildSystemInstruction(profile, conversationStateBlock)}\n\nPergunta atual:\n${firstUser.content}`.trim();
  }
  return injected;
}

function buildCompletionPrompt(history: ChatHistoryItem[], profile: GenerationProfile, conversationStateBlock = "") {
  const currentDate = buildCurrentDateContext();
  const lines = [LETICIA_SYSTEM_PROMPT.trim()];
  lines.push(currentDate.line);
  lines.push("Para perguntas com termos relativos (hoje, amanha, ontem), use essa data de referencia.");
  lines.push(
    "Regras criticas: responda a pergunta atual com continuidade contextual, preserve o objeto textual ativo e evite paragrafos fragmentados.",
  );
  lines.push(`Diretriz de estilo: ${profile.brevityInstruction}`);
  if (conversationStateBlock.trim()) {
    lines.push(`Estado conversacional consolidado:\n${conversationStateBlock.trim()}`);
  }
  history.forEach((item) => {
    const prefix = item.role === "assistant" ? "Assistente" : "Usuario";
    lines.push(`${prefix}: ${item.content}`);
  });
  lines.push("Assistente:");
  return lines.join("\n\n");
}

async function callLlm(url: string, payload: Record<string, unknown>, config: LlmConfig) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new LlmRouteError(504, "LLM_TIMEOUT", "Tempo limite ao consultar o motor de IA.");
    }
    const maybeCause = typeof error === "object" && error && "cause" in error ? (error as { cause?: { code?: string } }).cause : null;
    const code = maybeCause?.code || "";
    const connectivityCodes = new Set(["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EHOSTUNREACH"]);
    const suffix = connectivityCodes.has(code) ? ` (${code})` : "";
    throw new LlmRouteError(
      503,
      "LLM_UNAVAILABLE",
      `Motor local indisponivel em ${config.baseUrl}. Verifique se o vLLM esta ativo e acessivel${suffix}.`,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function resolveModelCandidates(config: LlmConfig, availableModels: string[]) {
  const configuredCandidates = Array.from(new Set([config.model, ...config.modelFallbacks].map((value) => value.trim()).filter(Boolean)));
  if (!availableModels.length) return configuredCandidates;

  const availableSet = new Set(availableModels);
  const configuredAvailable = configuredCandidates.filter((candidate) => availableSet.has(candidate));
  if (configuredAvailable.length > 0) {
    return Array.from(new Set([...configuredAvailable, ...configuredCandidates, ...availableModels]));
  }

  return Array.from(new Set([...availableModels, ...configuredCandidates]));
}

async function fetchAvailableModels(config: LlmConfig): Promise<string[]> {
  const now = Date.now();
  if (
    availableModelsCache &&
    availableModelsCache.baseUrl === config.baseUrl &&
    availableModelsCache.apiKey === config.apiKey &&
    availableModelsCache.expiresAt > now
  ) {
    return availableModelsCache.models;
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(1_500, Math.min(6_000, Math.floor(config.timeoutMs / 6)));
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${config.baseUrl}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json().catch(() => null)) as
      | { data?: Array<{ id?: unknown }>; models?: Array<{ id?: unknown } | string> }
      | null;
    if (!payload) {
      return [];
    }

    const fromData = Array.isArray(payload.data)
      ? payload.data.map((entry) => (typeof entry?.id === "string" ? entry.id.trim() : "")).filter(Boolean)
      : [];
    const fromModels = Array.isArray(payload.models)
      ? payload.models
          .map((entry) => {
            if (typeof entry === "string") return entry.trim();
            if (entry && typeof entry === "object" && "id" in entry) {
              const candidate = (entry as { id?: unknown }).id;
              return typeof candidate === "string" ? candidate.trim() : "";
            }
            return "";
          })
          .filter(Boolean)
      : [];

    const models = Array.from(new Set([...fromData, ...fromModels]));
    availableModelsCache = {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      models,
      expiresAt: Date.now() + AVAILABLE_MODELS_CACHE_TTL_MS,
    };
    return models;
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

type ExtractedChunk = {
  mode: "delta" | "full";
  text: string;
};

function extractTextFromChunk(payload: unknown, options?: { streaming?: boolean }): ExtractedChunk {
  if (!payload || typeof payload !== "object") return { mode: "full", text: "" };
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices.length) return { mode: "full", text: "" };
  const first = choices[0] as { delta?: { content?: unknown }; message?: { content?: unknown }; text?: unknown };
  if (typeof first?.delta?.content === "string") return { mode: "delta", text: first.delta.content };
  if (typeof first?.message?.content === "string") return { mode: "full", text: first.message.content };
  if (typeof first?.text === "string") {
    // OpenAI-like /completions: em streaming, `choices[0].text` eh delta; sem stream, eh texto final.
    return { mode: options?.streaming ? "delta" : "full", text: first.text };
  }
  return { mode: "full", text: "" };
}

function resolveDeltaFromFullText(previous: string, incoming: string) {
  if (!incoming) return { delta: "", nextState: previous };
  if (!previous) return { delta: incoming, nextState: incoming };
  if (incoming === previous) return { delta: "", nextState: previous };

  if (incoming.startsWith(previous)) {
    return { delta: incoming.slice(previous.length), nextState: incoming };
  }

  if (previous.startsWith(incoming)) {
    return { delta: "", nextState: previous };
  }

  if (incoming.includes(previous)) {
    const idx = incoming.indexOf(previous);
    return { delta: incoming.slice(idx + previous.length), nextState: incoming };
  }

  if (previous.includes(incoming)) {
    return { delta: "", nextState: previous };
  }

  let overlap = 0;
  const maxOverlap = Math.min(previous.length, incoming.length);
  for (let size = maxOverlap; size > 0; size -= 1) {
    if (previous.slice(-size) === incoming.slice(0, size)) {
      overlap = size;
      break;
    }
  }

  return { delta: incoming.slice(overlap), nextState: incoming };
}

async function mapNonStreamingToText(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => null);
    const text = extractTextFromChunk(payload, { streaming: false }).text;
    if (!text) {
      throw new LlmRouteError(502, "LLM_INVALID_RESPONSE", "Resposta invalida do motor de IA.");
    }
    return text;
  }
  const plain = await response.text();
  if (!plain.trim()) {
    throw new LlmRouteError(502, "LLM_EMPTY_RESPONSE", "Motor de IA retornou resposta vazia.");
  }
  return plain;
}

function createChunkedTextStream(text: string, chunkSize = 320) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (!text) {
        controller.close();
        return;
      }
      for (let index = 0; index < text.length; index += chunkSize) {
        controller.enqueue(encoder.encode(text.slice(index, index + chunkSize)));
      }
      controller.close();
    },
  });
}

function resolveAnmAnswer(payload: unknown): AnmChatResult {
  if (!payload || typeof payload !== "object") {
    throw new LlmRouteError(502, "ANM_INVALID_RESPONSE", "ANM retornou payload invalido.");
  }
  const candidate = payload as {
    answer?: unknown;
    text?: unknown;
    output?: unknown;
    trace_id?: unknown;
    traceId?: unknown;
  };
  const answerRaw =
    typeof candidate.answer === "string"
      ? candidate.answer
      : typeof candidate.text === "string"
        ? candidate.text
        : typeof candidate.output === "string"
          ? candidate.output
          : "";
  const answer = answerRaw.trim();
  if (!answer) {
    throw new LlmRouteError(502, "ANM_EMPTY_RESPONSE", "ANM nao retornou resposta textual.");
  }
  const traceCandidate = typeof candidate.trace_id === "string" ? candidate.trace_id : typeof candidate.traceId === "string" ? candidate.traceId : "";
  return { answer, traceId: traceCandidate || null };
}

async function requestAnmChat(
  config: EngineModeConfig,
  prompt: string,
  sharedIdentityRuntime?: Record<string, unknown> | null,
  options?: {
    mode?: "chat" | "proactive" | "voice" | "identity_aware";
    history?: ChatHistoryItem[];
    localeHint?: string;
    conversationKey?: string;
    userKey?: string;
  },
): Promise<AnmChatResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.anmTimeoutMs);
  try {
    const mode = options?.mode || "chat";
    const history = Array.isArray(options?.history) ? options.history.slice(-20) : [];
    const localeHint = (options?.localeHint || "").trim();
    const conversationKey = (options?.conversationKey || "").trim();
    const userKey = (options?.userKey || "").trim();

    const leticiaResponse = await fetch(`${config.anmBaseUrl}/assistant/leticia/respond`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: prompt,
        mode,
        history,
        locale_hint: localeHint || undefined,
        conversation_key: conversationKey || undefined,
        user_key: userKey || undefined,
        prompt,
        shared_identity_runtime: sharedIdentityRuntime || undefined,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (leticiaResponse.ok) {
      const payload = await leticiaResponse.json().catch(() => null);
      return resolveAnmAnswer(payload);
    }

    if (leticiaResponse.status !== 404) {
      const responseText = await leticiaResponse.text().catch(() => "");
      const detail = responseText.trim().slice(0, 240);
      throw new LlmRouteError(
        leticiaResponse.status >= 500 ? 503 : 502,
        "ANM_UPSTREAM_ERROR",
        `ANM respondeu com erro HTTP ${leticiaResponse.status}${detail ? ` (${detail})` : ""}.`,
      );
    }

    const legacyResponse = await fetch(`${config.anmBaseUrl}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: prompt,
        shared_identity_runtime: sharedIdentityRuntime || undefined,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!legacyResponse.ok) {
      const responseText = await legacyResponse.text().catch(() => "");
      const detail = responseText.trim().slice(0, 240);
      throw new LlmRouteError(
        legacyResponse.status >= 500 ? 503 : 502,
        "ANM_UPSTREAM_ERROR",
        `ANM respondeu com erro HTTP ${legacyResponse.status}${detail ? ` (${detail})` : ""}.`,
      );
    }

    const payload = await legacyResponse.json().catch(() => null);
    return resolveAnmAnswer(payload);
  } catch (error) {
    if (error instanceof LlmRouteError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new LlmRouteError(504, "ANM_TIMEOUT", "Tempo limite ao consultar o ANM backend.");
    }
    throw new LlmRouteError(503, "ANM_UNAVAILABLE", `ANM backend indisponivel em ${config.anmBaseUrl}.`);
  } finally {
    clearTimeout(timeoutId);
  }
}

function sseToPlainTextStream(response: Response) {
  if (!response.body) {
    throw new LlmRouteError(502, "LLM_EMPTY_STREAM", "Motor de IA nao retornou stream.");
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let emittedAny = false;
  let fullTextState = "";
  const mergeChunk = (chunk: ExtractedChunk) => {
    const incoming = chunk.text;
    if (!incoming) return "";

    // Modo delta: anexa diretamente e trata apenas casos claros de replay cumulativo.
    if (chunk.mode === "delta") {
      if (!fullTextState) {
        fullTextState = incoming;
        return incoming;
      }
      if (incoming === fullTextState) return "";
      if (incoming.startsWith(fullTextState)) {
        const delta = incoming.slice(fullTextState.length);
        fullTextState = incoming;
        return delta;
      }
      fullTextState += incoming;
      return incoming;
    }

    // Modo full/cumulativo: reconcilia com o estado previamente emitido.
    const { delta, nextState } = resolveDeltaFromFullText(fullTextState, incoming);
    fullTextState = nextState;
    return delta;
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = response.body!.getReader();
      let buffer = "";
      let closed = false;
      const processSseDataLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) return;
        const data = trimmed.slice(5).trim();
        if (!data) return;
        if (data === "[DONE]") {
          safeClose();
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const extracted = extractTextFromChunk(parsed, { streaming: true });
          const delta = mergeChunk(extracted);
          if (!delta) return;
          emittedAny = true;
          controller.enqueue(encoder.encode(delta));
        } catch {
          // Ignore malformed JSON chunks and continue stream parsing.
        }
      };
      const safeClose = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || "";
          for (const line of lines) processSseDataLine(line);
        }

        // Flush final decoder state and parse any trailing SSE line without newline terminator.
        buffer += decoder.decode();
        if (buffer.trim()) {
          const trailingLines = buffer.split(/\r?\n/);
          for (const line of trailingLines) {
            processSseDataLine(line);
            if (closed) return;
          }
        }
      } catch (error) {
        console.error("KNEXAI_STREAM_ERROR", error);
      } finally {
        safeClose();
      }
    },
  });

  return { stream, emittedAny: () => emittedAny };
}

async function requestLlmStreaming(
  config: LlmConfig,
  history: ChatHistoryItem[],
  prompt: string,
  conversationStateBlock = "",
) {
  const chatUrl = `${config.baseUrl}/chat/completions`;
  const completionUrl = `${config.baseUrl}/completions`;
  const profile = resolveGenerationProfile(prompt, config);
  const tokenCandidates = Array.from(
    new Set(
      [profile.maxTokens, Math.floor(profile.maxTokens * 0.75), Math.floor(profile.maxTokens * 0.5), 512, 384, 256, 128]
        .map((value) => Math.max(64, value))
        .filter((value) => Number.isFinite(value)),
    ),
  );

  const isTokenLimitFailure = (status: number, body: string) => {
    if (![400, 413, 422].includes(status)) return false;
    const signal = `${body || ""}`.toLowerCase();
    return /(max.?tokens|max_model_len|context|too long|exceed|token)/i.test(signal);
  };
  const isModelNotFoundFailure = (status: number, body: string) => {
    if (status !== 404) return false;
    const signal = `${body || ""}`.toLowerCase();
    return /(model).*(does not exist|not found|unknown)/i.test(signal) || /notfounderror/i.test(signal);
  };

  const shouldFallbackToCompletions = (status: number) => [400, 404, 405, 422].includes(status);
  let tokenLimitDetected = false;
  const triedModels: string[] = [];
  const availableModels = await fetchAvailableModels(config);
  const modelCandidates = resolveModelCandidates(config, availableModels);

  if (availableModels.length > 0 && modelCandidates[0] !== config.model) {
    console.warn("KNEXAI_MODEL_REORDER", {
      requestedModel: config.model,
      selectedFirstModel: modelCandidates[0],
      availableModels,
    });
  }

  const requestWithModel = async (modelName: string): Promise<Response> => {
    let chatFailure: { status: number; body: string } | null = null;

    for (let index = 0; index < tokenCandidates.length; index += 1) {
      const maxTokens = tokenCandidates[index];
      const isLastCandidate = index === tokenCandidates.length - 1;
      const chatPayload = {
        model: modelName,
        messages: buildChatMessages(history, profile, conversationStateBlock),
        temperature: profile.temperature,
        top_p: profile.topP,
        repetition_penalty: profile.repetitionPenalty,
        max_tokens: maxTokens,
        stream: true,
      };

      const chatResponse = await callLlm(chatUrl, chatPayload, config);
      if (chatResponse.ok) return chatResponse;

      const body = await chatResponse.text().catch(() => "");
      chatFailure = { status: chatResponse.status, body };
      if (isModelNotFoundFailure(chatResponse.status, body)) {
        throw new LlmRouteError(404, "LLM_MODEL_NOT_FOUND", `Modelo '${modelName}' nao encontrado no motor local.`);
      }
      if (isTokenLimitFailure(chatResponse.status, body)) {
        tokenLimitDetected = true;
        console.warn("KNEXAI_CHAT_TOKEN_RETRY", {
          status: chatResponse.status,
          model: modelName,
          maxTokens,
          nextAttempt: !isLastCandidate,
        });
        if (!isLastCandidate) continue;
      }
      if (!shouldFallbackToCompletions(chatResponse.status)) {
        console.error("KNEXAI_CHAT_ERROR", {
          status: chatResponse.status,
          model: modelName,
          bodySnippet: body.slice(0, 300),
        });
        throw new LlmRouteError(502, "LLM_UPSTREAM_ERROR", `Motor de IA retornou erro upstream (status ${chatResponse.status}).`);
      }
      break;
    }

    if (chatFailure) {
      console.warn("KNEXAI_CHAT_FALLBACK", {
        status: chatFailure.status,
        model: modelName,
        bodySnippet: chatFailure.body.slice(0, 300),
      });
    }

    for (let index = 0; index < tokenCandidates.length; index += 1) {
      const maxTokens = tokenCandidates[index];
      const isLastCandidate = index === tokenCandidates.length - 1;
      const completionPayload = {
        model: modelName,
        prompt: buildCompletionPrompt(history, profile, conversationStateBlock),
        temperature: profile.temperature,
        top_p: profile.topP,
        repetition_penalty: profile.repetitionPenalty,
        max_tokens: maxTokens,
        stream: true,
      };

      const completionResponse = await callLlm(completionUrl, completionPayload, config);
      if (completionResponse.ok) return completionResponse;

      const completionErrorBody = await completionResponse.text().catch(() => "");
      if (isModelNotFoundFailure(completionResponse.status, completionErrorBody)) {
        throw new LlmRouteError(404, "LLM_MODEL_NOT_FOUND", `Modelo '${modelName}' nao encontrado no motor local.`);
      }
      if (isTokenLimitFailure(completionResponse.status, completionErrorBody)) {
        tokenLimitDetected = true;
        console.warn("KNEXAI_COMPLETION_TOKEN_RETRY", {
          status: completionResponse.status,
          model: modelName,
          maxTokens,
          nextAttempt: !isLastCandidate,
        });
        if (!isLastCandidate) continue;
      }

      console.error("KNEXAI_COMPLETION_ERROR", {
        status: completionResponse.status,
        model: modelName,
        bodySnippet: completionErrorBody.slice(0, 300),
      });
      throw new LlmRouteError(502, "LLM_UPSTREAM_ERROR", `Motor de IA retornou erro upstream (status ${completionResponse.status}).`);
    }

    throw new LlmRouteError(502, "LLM_UPSTREAM_ERROR", "Falha ao consultar o motor de IA.");
  };

  for (const modelName of modelCandidates) {
    triedModels.push(modelName);
    try {
      return await requestWithModel(modelName);
    } catch (error) {
      if (error instanceof LlmRouteError && error.code === "LLM_MODEL_NOT_FOUND") {
        console.warn("KNEXAI_MODEL_FALLBACK", {
          requestedModel: config.model,
          attemptedModel: modelName,
          nextModel: modelCandidates.find((candidate) => !triedModels.includes(candidate)) || null,
        });
        continue;
      }
      throw error;
    }
  }

  if (tokenLimitDetected) {
    throw new LlmRouteError(
      422,
      "LLM_CONTEXT_LIMIT",
      "Contexto muito longo para o modelo atual. Reduza o historico ou ajuste LLM_MAX_TOKENS.",
    );
  }

  throw new LlmRouteError(
    502,
    "LLM_MODEL_NOT_FOUND",
    `Modelo logico '${config.model}' nao foi encontrado no motor local. Modelos tentados: ${triedModels.join(", ")}. ` +
      "Ajuste LLM_MODEL_NAME ou suba o vLLM com --served-model-name mistral-awq.",
  );
}

async function toClientTextStreamResponse(
  upstream: Response,
  policyContext: ResponsePolicyContext,
): Promise<Response> {
  const contentType = upstream.headers.get("content-type") || "";
  let rawText = "";
  if (contentType.includes("text/event-stream")) {
    const { stream } = sseToPlainTextStream(upstream);
    rawText = await new Response(stream).text();
  } else {
    rawText = await mapNonStreamingToText(upstream);
  }
  const cleaned = stripConversationRoleArtifacts(rawText);
  const enforced = enforceResponseStructure(cleaned || rawText, {
    state: policyContext.state,
    complexity: policyContext.complexity,
  });
  return new Response(createChunkedTextStream(enforced || cleaned || rawText), {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET() {
  const config = readLlmConfig();
  const engineMode = readEngineModeConfig();
  const anmResolution =
    engineMode.mode === "anm"
      ? await resolveReachableAnmBaseUrl({
          configuredBaseUrl: engineMode.anmBaseUrl,
          timeoutMs: Math.min(2_000, engineMode.anmTimeoutMs),
          healthPath: "/healthz",
        })
      : null;

  return Response.json(
    {
      ok: true,
      endpoint: "/api/knexai",
      provider: engineMode.mode === "anm" ? "anm-backend" : "openai-compatible",
      engineMode: engineMode.mode,
      anmBaseUrl: anmResolution?.baseUrl || engineMode.anmBaseUrl,
      anmConfiguredBaseUrl: engineMode.anmBaseUrl,
      anmAttemptedBaseUrls: anmResolution?.attemptedBaseUrls || [engineMode.anmBaseUrl],
      anmSoftTimeoutMs: engineMode.anmSoftTimeoutMs,
      anmFallbackToDirect: engineMode.fallbackToDirect,
      baseUrl: config.baseUrl,
      fallbackBaseUrls: config.fallbackBaseUrls,
      resolvedCandidates: resolveLlmBaseUrlCandidates(config),
      model: config.model,
      modelFallbacks: config.modelFallbacks,
      contextWindow: config.contextWindow,
      maxTokens: config.maxTokens,
    },
    { status: 200 },
  );
}

export async function POST(req: NextRequest) {
  const config = readLlmConfig();
  const engineMode = readEngineModeConfig();

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const prompt = body?.prompt ?? body?.message ?? body?.question;
    const history = body?.history;
    const safePrompt = typeof prompt === "string" ? prompt.trim() : "";
    if (!safePrompt) {
      return safeBackendError(400, "EMPTY_PROMPT", "Informe a mensagem atual em 'prompt' para enviar ao modelo.");
    }
    const pipelineVersion = parsePipelineVersionFromBody(body?.pipeline);
    const composerBound = parseOptionalBooleanFromBody(body?.composerBound);
    const composerAttachmentIds = parseOptionalPositiveIntArrayFromBody(body?.composerAttachmentIds);
    const topK = parseOptionalPositiveIntFromBody(body?.topK);
    const maxDistance = body?.maxDistance === null ? null : parseOptionalFiniteNumberFromBody(body?.maxDistance);
    const documentId = parseOptionalPositiveIntFromBody(body?.documentId);
    const documentIds = parseOptionalPositiveIntArrayFromBody(body?.documentIds);
    const sourceType = typeof body?.sourceType === "string" ? body.sourceType.trim() : "";
    const retrievalEmbeddingModel = typeof body?.retrievalEmbeddingModel === "string" ? body.retrievalEmbeddingModel.trim() : "";
    const preferredResponseLanguageId = parseOptionalLanguageIdFromBody(body?.preferredResponseLanguageId);
    const maxResponseTokens = parseOptionalPositiveIntFromBody(body?.maxResponseTokens);
    const temperature = parseOptionalFiniteNumberFromBody(body?.temperature);
    const seedRaw = body?.seed;
    const seed = seedRaw === null ? null : parseOptionalFiniteNumberFromBody(seedRaw);
    const anmEngineModeFromBody = parseOptionalEngineModeFromBody(body?.anmEngineMode ?? body?.engineMode);
    const anmBaseUrlFromBody = typeof body?.anmBaseUrl === "string" ? body.anmBaseUrl.trim() : "";
    const anmTimeoutMsFromBody = parseOptionalPositiveIntFromBody(body?.anmTimeoutMs);
    const anmSoftTimeoutMsFromBody = parseOptionalPositiveIntFromBody(body?.anmSoftTimeoutMs);
    const anmFallbackToDirectFromBody = parseOptionalBooleanFromBody(body?.anmFallbackToDirect);
    const streamRequested = parseOptionalBooleanFromBody(body?.stream) === true;
    const requestedStreamMode = parseStreamModeFromBody(body?.streamMode);
    const acceptHeader = `${req.headers.get("accept") || ""}`.toLowerCase();
    const streamMode = requestedStreamMode || (acceptHeader.includes("text/event-stream") ? "sse" : "plain");

    const hasDocumentScope =
      Boolean(documentId) ||
      Boolean(documentIds?.length) ||
      Boolean(composerAttachmentIds?.length) ||
      composerBound === true;
    const forceRagForVerifiable = true;
    const verifiableQuestion = isVerifiableQuestionForAutoSearch(safePrompt);
    const forceRag =
      parseOptionalBooleanFromBody(body?.forceRag) === true ||
      hasDocumentScope ||
      (forceRagForVerifiable && verifiableQuestion);

    if (!forceRag && isCurrentDatePrompt(safePrompt)) {
      return new Response(createChunkedTextStream(buildCurrentDateAnswer()), {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    if (!forceRag && isMicroSocialPrompt(safePrompt)) {
      return new Response(createChunkedTextStream(buildMicroSocialAnswer(safePrompt)), {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    const localeHintFromBody =
      (typeof body?.localeHint === "string" && body.localeHint.trim()) ||
      (typeof body?.locale === "string" && body.locale.trim()) ||
      "";
    const conversationKeyFromBody =
      (typeof body?.conversationKey === "string" && body.conversationKey.trim()) ||
      (typeof body?.conversation_key === "string" && body.conversation_key.trim()) ||
      (typeof body?.sessionId === "string" && body.sessionId.trim()) ||
      (typeof body?.threadId === "string" && body.threadId.trim()) ||
      "knexai:chat";
    const userKeyFromBody =
      (typeof body?.userKey === "string" && body.userKey.trim()) ||
      (typeof body?.user_key === "string" && body.user_key.trim()) ||
      "chat-session";

    const normalizedHistory = normalizeHistory(history);
    if (forceRag) {
      const ragEngineMode = verifiableQuestion ? "anm" : anmEngineModeFromBody || engineMode.mode;
      const ragAnmBaseUrl = anmBaseUrlFromBody || engineMode.anmBaseUrl;
      const ragAnmTimeoutMs = anmTimeoutMsFromBody || engineMode.anmTimeoutMs;
      const ragAnmSoftTimeoutMs = anmSoftTimeoutMsFromBody || engineMode.anmSoftTimeoutMs;
      const forceWebMultiSource = parseOptionalBoolean(process.env.KNEXAI_FORCE_MULTI_SOURCE_WEB_SEARCH) !== false;
      const ragAnmFallbackToDirect =
        forceWebMultiSource && verifiableQuestion
          ? false
          : typeof anmFallbackToDirectFromBody === "boolean"
            ? anmFallbackToDirectFromBody
            : engineMode.fallbackToDirect;
      const run = await assistantOrchestrator.run({
        requestId: typeof body?.requestId === "string" ? body.requestId : undefined,
        conversationKey: conversationKeyFromBody,
        mode: "chat",
        stream: streamRequested,
        message: safePrompt,
        conversation: normalizedHistory,
        attachments: buildAttachmentsFromComposer(composerAttachmentIds, documentIds),
        ragInput: {
          pipelineVersion,
          composerBound,
          composerAttachmentIds,
          topK,
          maxDistance,
          documentId,
          documentIds,
          sourceType: sourceType || undefined,
          retrievalEmbeddingModel: retrievalEmbeddingModel || undefined,
          preferredResponseLanguageId,
          maxResponseTokens,
          temperature,
          seed,
          anmEngineMode: ragEngineMode,
          anmBaseUrl: ragAnmBaseUrl,
          anmTimeoutMs: ragAnmTimeoutMs,
          anmSoftTimeoutMs: ragAnmSoftTimeoutMs,
          anmFallbackToDirect: ragAnmFallbackToDirect,
        },
      });

      if (streamRequested) {
        if (!run.stream) {
          throw new LlmRouteError(500, "ASSISTANT_STREAM_MISSING", "Falha ao abrir stream do assistant pipeline.");
        }
        const responseStream = streamMode === "sse" ? toSseStream(run.stream) : run.stream;
        return new Response(responseStream, {
          status: 200,
          headers: {
            "Content-Type": streamMode === "sse" ? "text/event-stream; charset=utf-8" : "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      }
      return Response.json(
        {
          ok: true,
          reply: {
            role: "assistant",
            content: run.content,
          },
          metadata: run.ragMetadata,
          meta: run.meta,
        },
        { status: 200 },
      );
    }

    const conversationState = rebuildConversationState({
      conversationKey: conversationKeyFromBody,
      prompt: safePrompt,
      history: normalizedHistory,
      localeHint: localeHintFromBody,
    });
    const conversationStateBlock = buildConversationStateSummaryBlock(conversationState);
    const responsePolicyContext: ResponsePolicyContext = {
      state: conversationState,
      complexity: classifyPromptComplexity(safePrompt),
    };
    const autoWebEvidence = await buildAutomaticWebEvidence(safePrompt).catch((error) => {
      console.warn("KNEXAI_AUTO_WEB_SEARCH_FAILED", {
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    });
    const autoWebContextBlock = autoWebEvidence?.contextBlock?.trim() || "";
    if (autoWebEvidence) {
      console.info("KNEXAI_AUTO_WEB_SEARCH_CONTEXT", {
        queryCount: autoWebEvidence.queryCount,
        resultCount: autoWebEvidence.resultCount,
        sources: autoWebEvidence.sources,
      });
    }
    const forceWebMultiSource = parseOptionalBoolean(process.env.KNEXAI_FORCE_MULTI_SOURCE_WEB_SEARCH) !== false;
    const hasWebEvidence = Boolean(autoWebEvidence && autoWebEvidence.resultCount > 0);
    if (!forceRag && forceWebMultiSource && verifiableQuestion && !hasWebEvidence) {
      const fallbackText = buildWebVerificationUnavailableAnswer(localeHintFromBody);
      return new Response(createChunkedTextStream(fallbackText), {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const clientSharedIdentityRuntime =
      normalizeRecord(body?.sharedIdentityRuntime) || normalizeRecord(body?.shared_identity_runtime);
    const identitySharedMemory = await resolveIdentityRuntimeSharedContext();
    const promptForAnm = injectConversationStatePrompt(
      autoWebContextBlock ? `${safePrompt}\n\n${autoWebContextBlock}` : safePrompt,
      conversationStateBlock,
    );
    const promptForDirect = safePrompt;
    const directContextBlock = [conversationStateBlock.trim(), identitySharedMemory.promptBlock.trim(), autoWebContextBlock]
      .filter(Boolean)
      .join("\n\n");
    const sharedIdentityRuntimePayload = clientSharedIdentityRuntime
      ? {
          source: "client_identity_snapshot",
          client_snapshot: clientSharedIdentityRuntime,
        }
      : null;

    const safeHistory = sanitizeHistoryForModel(ensurePrompt(normalizedHistory, promptForDirect));
    const effectiveHistory = optimizeHistoryForLatency(
      resolveEffectiveHistory(safeHistory, promptForDirect),
      promptForDirect,
    );
    const safeAnmHistory = sanitizeHistoryForModel(ensurePrompt(normalizedHistory, promptForDirect));
    const anmEffectiveHistory = optimizeHistoryForLatency(
      resolveEffectiveHistory(safeAnmHistory, promptForDirect),
      promptForDirect,
    );
    const anmRequestOptions = {
      mode: "chat" as const,
      history: anmEffectiveHistory,
      localeHint: localeHintFromBody,
      conversationKey: conversationKeyFromBody,
      userKey: userKeyFromBody,
    };
    const anmResolution =
      engineMode.mode === "anm"
        ? await resolveReachableAnmBaseUrl({
            configuredBaseUrl: engineMode.anmBaseUrl,
            timeoutMs: Math.min(2_000, engineMode.anmSoftTimeoutMs),
            healthPath: "/healthz",
          })
        : null;
    const effectiveEngineMode =
      anmResolution && engineMode.mode === "anm"
        ? { ...engineMode, anmBaseUrl: anmResolution.baseUrl }
        : engineMode;

    if (effectiveEngineMode.mode === "anm") {
      if (effectiveEngineMode.fallbackToDirect) {
        const strictAnmPrimary = parseOptionalBoolean(process.env.KNEXAI_ANM_STRICT_PRIMARY) !== false;
        if (strictAnmPrimary) {
          const anmAttempt = await requestAnmChat(effectiveEngineMode, promptForAnm, sharedIdentityRuntimePayload, anmRequestOptions)
            .then((anm) => toAttemptOk("anm", anm))
            .catch((error: unknown) => toAttemptError("anm", error));
          if (anmAttempt.ok && anmAttempt.source === "anm") {
            console.info("KNEXAI_ANM_CHAT_OK", {
              traceId: anmAttempt.value.traceId,
              anmBaseUrl: effectiveEngineMode.anmBaseUrl,
              answerChars: anmAttempt.value.answer.length,
              routePolicy: "anm_strict_primary",
            });
            return toAnmTextResponse(anmAttempt.value, responsePolicyContext);
          }

          const directHealth = await probeDirectHealth(config);
          if (!directHealth.ok) {
            const directUnavailable = toAttemptError(
              "direct",
              new LlmRouteError(
                503,
                "LLM_UNAVAILABLE",
                `Motor local indisponivel em ${config.baseUrl}. Endpoints tentados: ${(directHealth.attemptedBaseUrls || [config.baseUrl]).join(", ")}.`,
              ),
            );
            throw buildEngineCompositeError([anmAttempt, directUnavailable]);
          }

          const directConfig = applyResolvedLlmBaseUrl(config, directHealth.baseUrl);
          const directAttempt = await requestLlmStreaming(directConfig, effectiveHistory, promptForDirect, directContextBlock)
            .then((upstream) => toAttemptOk("direct", upstream))
            .catch((error: unknown) => toAttemptError("direct", error));
          if (directAttempt.ok && directAttempt.source === "direct") {
            return toClientTextStreamResponse(directAttempt.value, responsePolicyContext);
          }
          throw buildEngineCompositeError([anmAttempt, directAttempt]);
        }

        const [anmHealth, directHealth] = await Promise.all([probeAnmHealth(effectiveEngineMode), probeDirectHealth(config)]);
        const directConfig = applyResolvedLlmBaseUrl(config, directHealth.baseUrl);
        console.info("KNEXAI_ENGINE_HEALTH_SNAPSHOT", {
          mode: effectiveEngineMode.mode,
          anmOk: anmHealth.ok,
          anmStatus: anmHealth.status,
          anmDetail: anmHealth.detail,
          directOk: directHealth.ok,
          directStatus: directHealth.status,
          directDetail: directHealth.detail,
          anmConfiguredBaseUrl: engineMode.anmBaseUrl,
          anmSelectedBaseUrl: effectiveEngineMode.anmBaseUrl,
          anmAttemptedBaseUrls: anmResolution?.attemptedBaseUrls || [engineMode.anmBaseUrl],
          directConfiguredBaseUrl: config.baseUrl,
          directSelectedBaseUrl: directConfig.baseUrl,
          directAttemptedBaseUrls: directHealth.attemptedBaseUrls || [],
          identitySharedMemoryStatus: identitySharedMemory.status,
          identitySharedMemoryChars: identitySharedMemory.promptBlock.length,
        });

        if (anmHealth.ok && !directHealth.ok) {
          const anmAttempt = await requestAnmChat(effectiveEngineMode, promptForAnm, sharedIdentityRuntimePayload, anmRequestOptions)
            .then((anm) => toAttemptOk("anm", anm))
            .catch((error: unknown) => toAttemptError("anm", error));
          if (anmAttempt.ok && anmAttempt.source === "anm") {
            console.info("KNEXAI_ANM_CHAT_OK", {
              traceId: anmAttempt.value.traceId,
              anmBaseUrl: effectiveEngineMode.anmBaseUrl,
              answerChars: anmAttempt.value.answer.length,
              routePolicy: "anm_only_due_direct_unhealthy",
            });
            return toAnmTextResponse(anmAttempt.value, responsePolicyContext);
          }
          const directAttempt = await requestLlmStreaming(directConfig, effectiveHistory, promptForDirect, directContextBlock)
            .then((upstream) => toAttemptOk("direct", upstream))
            .catch((error: unknown) => toAttemptError("direct", error));
          if (directAttempt.ok && directAttempt.source === "direct") {
            return toClientTextStreamResponse(directAttempt.value, responsePolicyContext);
          }
          throw buildEngineCompositeError([anmAttempt, directAttempt]);
        }

        if (!anmHealth.ok && directHealth.ok) {
          const directAttempt = await requestLlmStreaming(directConfig, effectiveHistory, promptForDirect, directContextBlock)
            .then((upstream) => toAttemptOk("direct", upstream))
            .catch((error: unknown) => toAttemptError("direct", error));
          if (directAttempt.ok && directAttempt.source === "direct") {
            return toClientTextStreamResponse(directAttempt.value, responsePolicyContext);
          }
          const anmAttempt = await requestAnmChat(effectiveEngineMode, promptForAnm, sharedIdentityRuntimePayload, anmRequestOptions)
            .then((anm) => toAttemptOk("anm", anm))
            .catch((error: unknown) => toAttemptError("anm", error));
          if (anmAttempt.ok && anmAttempt.source === "anm") {
            console.info("KNEXAI_ANM_CHAT_OK", {
              traceId: anmAttempt.value.traceId,
              anmBaseUrl: effectiveEngineMode.anmBaseUrl,
              answerChars: anmAttempt.value.answer.length,
              routePolicy: "anm_fallback_after_direct_failure",
            });
            return toAnmTextResponse(anmAttempt.value, responsePolicyContext);
          }
          throw buildEngineCompositeError([directAttempt, anmAttempt]);
        }

        if (!anmHealth.ok && !directHealth.ok) {
          throw new LlmRouteError(
            503,
            "ENGINE_PATHS_UNAVAILABLE",
            `ANM indisponivel (${anmHealth.detail}) e LLM direta indisponivel (${directHealth.detail}).` +
              ` Endpoints ANM tentados: ${(anmResolution?.attemptedBaseUrls || [effectiveEngineMode.anmBaseUrl]).join(", ")}.` +
              ` Endpoints diretos tentados: ${(directHealth.attemptedBaseUrls || [config.baseUrl]).join(", ")}.`,
          );
        }

        const anmSoftPromise = requestAnmChat(
          { ...effectiveEngineMode, anmTimeoutMs: effectiveEngineMode.anmSoftTimeoutMs },
          promptForAnm,
          sharedIdentityRuntimePayload,
          anmRequestOptions,
        )
          .then((anm) => toAttemptOk("anm", anm))
          .catch((error: unknown) => toAttemptError("anm", error));
        const directPromise = requestLlmStreaming(directConfig, effectiveHistory, promptForDirect, directContextBlock)
          .then((upstream) => toAttemptOk("direct", upstream))
          .catch((error: unknown) => toAttemptError("direct", error));

        const first = await Promise.race([anmSoftPromise, directPromise]);
        if (first.ok && first.source === "anm") {
          const anm = first.value as AnmChatResult;
          console.info("KNEXAI_ANM_CHAT_OK", {
            traceId: anm.traceId,
            anmBaseUrl: effectiveEngineMode.anmBaseUrl,
            answerChars: anm.answer.length,
            routePolicy: "anm_soft_won_race",
          });
          return toAnmTextResponse(anm, responsePolicyContext);
        }
        if (first.ok && first.source === "direct") {
          const upstream = first.value as Response;
          return toClientTextStreamResponse(upstream, responsePolicyContext);
        }

        if (!first.ok && first.source === "anm") {
          const second = await directPromise;
          if (second.ok && second.source === "direct") {
            return toClientTextStreamResponse(second.value, responsePolicyContext);
          }
          const hardAnm = await requestAnmChat(effectiveEngineMode, promptForAnm, sharedIdentityRuntimePayload, anmRequestOptions)
            .then((anm) => toAttemptOk("anm", anm))
            .catch((error: unknown) => toAttemptError("anm", error));
          if (hardAnm.ok && hardAnm.source === "anm") {
            console.info("KNEXAI_ANM_CHAT_OK", {
              traceId: hardAnm.value.traceId,
              anmBaseUrl: effectiveEngineMode.anmBaseUrl,
              answerChars: hardAnm.value.answer.length,
              routePolicy: "anm_hard_retry_after_soft_timeout",
            });
            return toAnmTextResponse(hardAnm.value, responsePolicyContext);
          }
          throw buildEngineCompositeError([first, second, hardAnm]);
        }

        if (!first.ok && first.source === "direct") {
          const hardAnm = await requestAnmChat(effectiveEngineMode, promptForAnm, sharedIdentityRuntimePayload, anmRequestOptions)
            .then((anm) => toAttemptOk("anm", anm))
            .catch((error: unknown) => toAttemptError("anm", error));
          if (hardAnm.ok && hardAnm.source === "anm") {
            console.info("KNEXAI_ANM_CHAT_OK", {
              traceId: hardAnm.value.traceId,
              anmBaseUrl: effectiveEngineMode.anmBaseUrl,
              answerChars: hardAnm.value.answer.length,
              routePolicy: "anm_hard_after_direct_failure",
            });
            return toAnmTextResponse(hardAnm.value, responsePolicyContext);
          }
          throw buildEngineCompositeError([first, hardAnm]);
        }
      } else {
        const anm = await requestAnmChat(effectiveEngineMode, promptForAnm, sharedIdentityRuntimePayload, anmRequestOptions);
        console.info("KNEXAI_ANM_CHAT_OK", {
          traceId: anm.traceId,
          anmBaseUrl: effectiveEngineMode.anmBaseUrl,
          answerChars: anm.answer.length,
        });
        return toAnmTextResponse(anm, responsePolicyContext);
      }
    }

    const directHealth = await probeDirectHealth(config);
    if (!directHealth.ok) {
      throw new LlmRouteError(
        503,
        "LLM_UNAVAILABLE",
        `Motor local indisponivel em ${config.baseUrl}. Endpoints tentados: ${(directHealth.attemptedBaseUrls || [config.baseUrl]).join(", ")}.`,
      );
    }
    const directConfig = applyResolvedLlmBaseUrl(config, directHealth.baseUrl);
    const upstream = await requestLlmStreaming(directConfig, effectiveHistory, promptForDirect, directContextBlock);
    return toClientTextStreamResponse(upstream, responsePolicyContext);
  } catch (error) {
    if (error instanceof LlmRouteError) {
      console.error("KNEXAI_LLM_ERROR", { code: error.code, status: error.status, message: error.message });
      return safeBackendError(error.status, error.code, error.message);
    }
    if (error instanceof RagPipelineError) {
      console.error("KNEXAI_RAG_PIPELINE_ERROR", { code: error.code, status: error.status, message: error.message });
      return safeBackendError(error.status, error.code, error.message);
    }
    console.error("KNEXAI_POST_UNEXPECTED_ERROR", error);
    return safeBackendError(500, "INTERNAL_ERROR", "Erro interno ao processar a requisicao.");
  }
}




