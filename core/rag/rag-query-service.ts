import path from "node:path";
import { resolveVectorSearchParams, type VectorSearchParams } from "../database/vector-search-params";
import { createVectorDatabaseClient, type VectorDatabaseClient } from "../database/vector-client";
import { resolveIdentityRuntimeSharedContext } from "../identity/shared-memory-context";
import { logger } from "../utils/logger";
import { assembleContextPack, type ContextPackChunk } from "./context-pack";
import { routeComplexity, type ComplexityDecision, type ComplexityMode } from "./complexity-router";
import { buildComposerRagContract } from "./contracts/composer_rag_contract";
import { createDocumentFullTextService, type DocumentFullTextService } from "./document-fulltext-service";
import { createQueryEmbeddingClient, type QueryEmbeddingClient } from "./embedding-client";
import {
  loadRagContextConfig,
  loadRagGenerationConfig,
  loadRagPipelineFlags,
  loadRagResilienceConfig,
  type RagGenerationConfig,
  type RagPipelineFlags,
  type RagResilienceConfig,
} from "./rag-config";
import { RagPipelineError } from "./rag-errors";
import { createRagRetrievalService, type RagRetrievalResult, type RagRetrievalService } from "./retrieval-service";
import {
  createRagInternetSearchService,
  type InternetSearchResponse,
  type RagInternetSearchService,
} from "./internet-search-service";
import { createVllmInternalClient, type RagChatHistoryItem, type VllmInternalClient } from "./vllm-client";
import { RagOrchestratorV2 } from "./v2/orchestrator_v2";
import { resolveIdentityFallbackForMessage } from "../../ai-system-anm-rag-qis/src/17b-response-behavior-layer/ai-identity-regulator";
import { textNormalizationService } from "../../ai-system-anm-rag-qis/src/shared/text-processing/text-normalization.service";

type RagLatencyPreset = "default" | "aggressive";
type QueryComplexity = "simple" | "standard" | "deep";
type RagProcessingMode = ComplexityMode;

type StreamRuntimeProfile = {
  contextCap: number;
  historyMaxMessages: number;
  historyMaxChars: number;
  maxTokensCap: number;
};

const KNX_STREAM_EVENT_START = "[[KNX_EVT]]";
const KNX_STREAM_EVENT_END = "[[/KNX_EVT]]";
const DEFAULT_LLM_CONTEXT_WINDOW_TOKENS = 8192;

type ChunkAuditRecord = {
  chunkId: number;
  documentId: number;
  chunkIndex: number;
  distance: number;
  score: number;
  embeddingModel: string;
  sourceType: string;
  sourcePath: string;
  title: string | null;
  tokenCount: number | null;
  charStart: number;
  charEnd: number;
  snippet: string;
};

export type RagQueryInput = {
  question: string;
  routingHint?: string;
  pipelineModeOverride?: "auto" | "lite" | "full";
  history?: RagChatHistoryItem[];
  requestId?: string;
  pipelineVersion?: "v1" | "v2";
  composerBound?: boolean;
  composerAttachmentIds?: number[];
  scopeMode?: "global_rag" | "request_document_scope" | "composer_strict" | "composer_plus_rag";
  strictDocumentGrounding?: boolean;
  topK?: number;
  maxDistance?: number | null;
  documentId?: number;
  documentIds?: number[];
  priorityDocumentIds?: number[];
  sourceType?: string;
  retrievalEmbeddingModel?: string;
  maxResponseTokens?: number;
  temperature?: number;
  seed?: number | null;
  preferredResponseLanguageId?: string;
  anmEngineMode?: "direct" | "anm";
  anmBaseUrl?: string;
  anmTimeoutMs?: number;
  anmSoftTimeoutMs?: number;
  anmFallbackToDirect?: boolean;
};

type RouterStats = {
  total: number;
  lite: number;
  full: number;
  fullNearLite: number;
};

type RouterStatsSnapshot = RouterStats & {
  fullPct: number;
  litePct: number;
  fullNearLitePct: number;
};

const GLOBAL_ROUTER_STATS: RouterStats = {
  total: 0,
  lite: 0,
  full: 0,
  fullNearLite: 0,
};

export type RagQueryResult = {
  answer: string;
  metadata: {
    resilience: {
      embeddingFailureMode: "strict" | "degrade";
      degraded: boolean;
      degradedCode: string | null;
      degradedMessage: string | null;
      usedDocumentScopeFallback: boolean;
    };
    retrieval: {
      topK: number;
      maxDistance: number | null;
      strategy: "cosine" | "hybrid_v2";
      filters: {
        documentId: number | null;
        documentIds: number[];
        sourceType: string | null;
        embeddingModel: string | null;
      };
      returnedChunks: number;
    };
    contextPack: {
      selectedChunks: number;
      omittedChunks: number;
      totalCandidateChunks: number;
      maxChars: number;
      usedChars: number;
      truncated: boolean;
      budget?: {
        contextBudgetTokens: number;
        answerBudgetTokens: number;
        safetyMarginTokens: number;
      };
    };
    fullDocumentRead: {
      enabled: boolean;
      attemptedDocs: number;
      loadedDocs: number;
      contextDocs: number;
      failedDocs: number;
      fullReadChars: number;
      includedChars: number;
      truncatedDocs: number;
      sources: Array<{
        documentId: number;
        title: string | null;
        sourcePath: string;
        readSource: "extracted_text_file" | "document_chunks";
        fullChars: number;
        includedChars: number;
        truncated: boolean;
      } | Record<string, unknown>>;
    };
    chunks: ChunkAuditRecord[];
    queryEmbedding: {
      model: string;
      dimension: number;
    };
    llm: {
      provider: "vllm_internal";
      baseUrl: string;
      model: string;
      runtimeMode?: "lite" | "full";
      maxTokens: number;
      temperature: number;
      seed: number | null;
      finishReason: string | null;
      usage: {
        promptTokens: number | null;
        completionTokens: number | null;
        totalTokens: number | null;
      };
    };
    timingsMs: {
      embedding: number;
      retrieval: number;
      contextAssembly: number;
      llm: number;
      total: number;
    };
    citations?: {
      enabled: boolean;
      count: number;
      uncoveredClaims: number;
    };
    v2?: {
      runId: string;
      pipelineVersion: "v2";
      queryHash: string;
      traceStages: Array<{ stage: string; elapsedMs: number }>;
    };
  };
};

type RagQueryServiceOptions = {
  embeddingClient?: QueryEmbeddingClient;
  retrievalService?: RagRetrievalService;
  llmClient?: VllmInternalClient;
  fullDocumentService?: DocumentFullTextService;
  vectorDb?: VectorDatabaseClient;
  internetSearchService?: RagInternetSearchService;
  generationConfig?: RagGenerationConfig;
  resilienceConfig?: RagResilienceConfig;
  contextConfig?: {
    maxChars: number;
    maxChunks: number;
  };
  pipelineFlags?: RagPipelineFlags;
  latencyPreset?: RagLatencyPreset;
};

type QueryDegradationState = {
  degraded: boolean;
  code: string | null;
  message: string | null;
  usedDocumentScopeFallback: boolean;
};

type QueryPreparationResult = {
  retrieval: RagRetrievalResult;
  embedding: {
    model: string;
    dimension: number;
    elapsedMs: number;
  };
  appliedRetrievalModelFilter: string;
  degradation: QueryDegradationState;
  fullDocumentSeedIds: number[];
};

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function truncateSnippet(text: string, max = 220) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(32, max - 3)).trimEnd()}...`;
}

function toChunkAudit(row: ContextPackChunk): ChunkAuditRecord {
  return {
    chunkId: row.chunkId,
    documentId: row.documentId,
    chunkIndex: row.chunkIndex,
    distance: row.distance,
    score: row.score,
    embeddingModel: row.embeddingModel,
    sourceType: row.sourceType,
    sourcePath: row.sourcePath,
    title: row.title,
    tokenCount: row.tokenCount,
    charStart: row.charStart,
    charEnd: row.charEnd,
    snippet: truncateSnippet(row.text),
  };
}

function clampMaxTokens(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value as number)) return fallback;
  const rounded = Math.round(value as number);
  return Math.min(65_536, Math.max(32, rounded));
}

function clampTemperature(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value as number)) return fallback;
  return Math.max(0, Math.min(2, Number(value)));
}

function parsePositiveInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function parseOptionalBoolean(value: string | undefined) {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return undefined;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

function resolveLlmContextWindowTokens() {
  const raw = process.env.RAG_LLM_CONTEXT_WINDOW || process.env.LLM_CONTEXT_WINDOW || process.env.VLLM_CONTEXT_WINDOW;
  return parsePositiveInt(raw, DEFAULT_LLM_CONTEXT_WINDOW_TOKENS, 512, 262_144);
}

function resolveSafeOutputTokenCap(contextWindowTokens: number) {
  const ratioPercent = parsePositiveInt(process.env.RAG_SAFE_OUTPUT_RATIO_PERCENT, 40, 10, 90);
  const reserveInputTokens = parsePositiveInt(process.env.RAG_SAFE_INPUT_RESERVE_TOKENS, 1536, 128, 131_072);
  const ratioCap = Math.max(64, Math.trunc((contextWindowTokens * ratioPercent) / 100));
  const reserveCap = Math.max(64, contextWindowTokens - reserveInputTokens);
  return Math.max(64, Math.min(ratioCap, reserveCap));
}

function parseLatencyPreset(value: string | undefined): RagLatencyPreset {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "aggressive") return "aggressive";
  return "default";
}

function parseProcessingMode(value: string | undefined): RagProcessingMode | undefined {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (normalized === "lite") return "lite";
  if (normalized === "full") return "full";
  return undefined;
}

function toRouterStatsSnapshot(stats: RouterStats): RouterStatsSnapshot {
  const fullPct = stats.total > 0 ? Math.round((stats.full / stats.total) * 1000) / 10 : 0;
  const litePct = stats.total > 0 ? Math.round((stats.lite / stats.total) * 1000) / 10 : 0;
  const fullNearLitePct = stats.full > 0 ? Math.round((stats.fullNearLite / stats.full) * 1000) / 10 : 0;
  return {
    ...stats,
    fullPct,
    litePct,
    fullNearLitePct,
  };
}

function inferQueryComplexity(question: string): QueryComplexity {
  const normalized = `${question || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
  if (!normalized) return "standard";

  const wordCount = normalized.split(/\s+/g).filter(Boolean).length;
  const asksSimple =
    /\b(resuma|resumo curto|curto|curta|objetivo|em uma frase|1 frase|oi|ola|bom dia|boa tarde|boa noite)\b/.test(normalized) ||
    wordCount <= 8;
  if (asksSimple) return "simple";

  const asksDeep =
    /\b(detalhe|aprofunde|analise|analisar|compare|passo a passo|completo|abrangente|causas?|consequenc|implicac|trade[- ]?off|metodologia)\b/.test(
      normalized,
    ) || wordCount >= 18;
  if (asksDeep) return "deep";

  return "standard";
}

function buildStreamRuntimeProfile(input: {
  complexity: QueryComplexity;
  requestedMaxTokens: number;
  effectiveAggressive: boolean;
  weakEvidence: boolean;
}) {
  const { complexity, requestedMaxTokens, effectiveAggressive, weakEvidence } = input;
  let profile: StreamRuntimeProfile;
  if (complexity === "simple") {
    profile = {
      contextCap: 12_000,
      historyMaxMessages: 6,
      historyMaxChars: 6_000,
      maxTokensCap: Math.min(4_096, requestedMaxTokens),
    };
  } else if (complexity === "deep") {
    profile = {
      contextCap: 24_000,
      historyMaxMessages: 16,
      historyMaxChars: 16_000,
      maxTokensCap: requestedMaxTokens,
    };
  } else {
    profile = {
      contextCap: 18_000,
      historyMaxMessages: 10,
      historyMaxChars: 10_000,
      maxTokensCap: Math.min(6_144, requestedMaxTokens),
    };
  }

  if (effectiveAggressive && complexity !== "deep") {
    profile = {
      contextCap: complexity === "simple" ? 9_000 : 14_000,
      historyMaxMessages: complexity === "simple" ? 4 : 8,
      historyMaxChars: complexity === "simple" ? 4_000 : 8_000,
      maxTokensCap: Math.min(complexity === "simple" ? 3_072 : 4_096, requestedMaxTokens),
    };
  }

  if (weakEvidence) {
    // Precisao primeiro: se evidencias fracas, sobe profundidade minima automaticamente.
    profile = {
      contextCap: Math.max(profile.contextCap, 18_000),
      historyMaxMessages: Math.max(profile.historyMaxMessages, 8),
      historyMaxChars: Math.max(profile.historyMaxChars, 8_000),
      maxTokensCap: requestedMaxTokens,
    };
  }

  return profile;
}

function resolveStreamMulticallPassCount(input: {
  complexity: QueryComplexity;
  pipelineVersion: "v1" | "v2";
  weakEvidence: boolean;
}) {
  const enabledRaw = parseOptionalBoolean(process.env.RAG_STREAM_MULTICALL_ENABLED);
  if (enabledRaw === false) return 1;

  const maxPasses = parsePositiveInt(process.env.RAG_STREAM_MULTICALL_MAX_PASSES, 4, 1, 8);
  const minPassesDefault = input.pipelineVersion === "v2" ? 2 : 1;
  const minPasses = parsePositiveInt(process.env.RAG_STREAM_MULTICALL_MIN_PASSES, minPassesDefault, 1, 8);

  let basePasses = 1;
  if (input.complexity === "standard") basePasses = 2;
  if (input.complexity === "deep") basePasses = 3;
  if (input.pipelineVersion === "v2") basePasses = Math.max(2, basePasses);
  if (input.weakEvidence) basePasses = Math.max(basePasses, 2);

  return Math.max(minPasses, Math.min(maxPasses, basePasses));
}

function buildStreamMulticallQuestion(question: string, passIndex: number, totalPasses: number) {
  if (totalPasses <= 1) return question;
  if (passIndex <= 1) {
    return `${question}\n\n[PASSO ${passIndex}/${totalPasses}] Entregue a base da resposta com foco no essencial.`;
  }
  if (passIndex < totalPasses) {
    return `${question}\n\n[PASSO ${passIndex}/${totalPasses}] Continue de onde parou, aprofunde e evite repetir argumentos.`;
  }
  return `${question}\n\n[PASSO ${passIndex}/${totalPasses}] Consolide em sintese final coerente, sem repeticao e no mesmo idioma da pergunta.`;
}

function encodeKnxStreamEvent(payload: Record<string, unknown>) {
  try {
    return `${KNX_STREAM_EVENT_START}${JSON.stringify(payload)}${KNX_STREAM_EVENT_END}`;
  } catch {
    return "";
  }
}

function normalizeSeed(value: number | null | undefined, fallback: number | null) {
  if (value === null) return null;
  if (!Number.isFinite(value as number)) return fallback;
  return Math.trunc(value as number);
}

function normalizeHistory(history: RagChatHistoryItem[] | undefined, config: RagGenerationConfig): RagChatHistoryItem[] {
  if (!Array.isArray(history) || !history.length || config.historyMaxMessages <= 0 || config.historyMaxChars <= 0) {
    return [];
  }

  const reversed = [...history].reverse();
  const selectedReversed: RagChatHistoryItem[] = [];
  let usedChars = 0;

  for (const row of reversed) {
    if (selectedReversed.length >= config.historyMaxMessages) break;
    if (!row || (row.role !== "user" && row.role !== "assistant")) continue;
    const content = normalizeString(row.content);
    if (!content) continue;
    if (usedChars + content.length > config.historyMaxChars) break;
    selectedReversed.push({ role: row.role, content });
    usedChars += content.length;
  }

  return selectedReversed.reverse();
}

function normalizeDocumentId(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.trunc(parsed);
  return normalized > 0 ? normalized : null;
}

function normalizeDocumentIds(values: unknown, maxItems = 64): number[] {
  if (!Array.isArray(values)) return [];
  const normalized: number[] = [];
  const seen = new Set<number>();
  for (const raw of values) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) continue;
    const value = Math.trunc(parsed);
    if (value <= 0 || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
    if (normalized.length >= maxItems) break;
  }
  return normalized;
}

function buildEmptyRetrievalResult(input: Pick<RagQueryInput, "topK" | "maxDistance">): RagRetrievalResult {
  const params: VectorSearchParams = resolveVectorSearchParams({
    topK: input.topK,
    maxDistance: input.maxDistance,
  });
  return {
    hits: [],
    params,
    elapsedMs: 0,
  };
}

type LocalIntentReply = {
  answer: string;
  reason:
    | "GREETING_FAST_PATH"
    | "SMALL_TALK_FAST_PATH"
    | "ASSISTANT_IDENTITY_FAST_PATH"
    | "ASSISTANT_IDENTITY_AMBIGUOUS"
    | "ASSISTANT_NAME_SEMANTICS_FAST_PATH"
    | "ASSISTANT_CREATOR_FAST_PATH"
    | "DOCUMENT_REFERENCE_CANCELLED"
    | "WEB_SEARCH_NO_QUERY"
    | "WEB_SEARCH_RESULT"
    | "WEB_SEARCH_UNAVAILABLE"
    | "DOCUMENT_REFERENCE_AMBIGUOUS"
    | "DOCUMENT_REFERENCE_MISSING"
    | "DOCUMENT_GROUNDING_REQUIRED";
};

function resolveTimeZoneForGreeting() {
  const configured = `${process.env.AI_SYSTEM_TIMEZONE || process.env.TZ || "America/Sao_Paulo"}`.trim();
  if (!configured) return "America/Sao_Paulo";
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: configured }).format(new Date());
    return configured;
  } catch {
    return "America/Sao_Paulo";
  }
}

function resolveClockGreetingLabel() {
  const timeZone = resolveTimeZoneForGreeting();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
  }).formatToParts(new Date());
  const hour = Number.parseInt(parts.find((item) => item.type === "hour")?.value || "12", 10);
  if (hour >= 5 && hour <= 11) return "Bom dia";
  if (hour >= 12 && hour <= 17) return "Boa tarde";
  return "Boa noite";
}

function pickGreetingVariant(value: string, variants: string[]) {
  if (!variants.length) return "";
  const normalized = normalizeIntentText(value);
  const seed = Math.max(0, normalized.length);
  return variants[seed % variants.length];
}

function buildGreetingFastReply(value: string) {
  const salutation = resolveGreetingLead(value);
  return pickGreetingVariant(value, [
    `${salutation} Como posso te ajudar agora?`,
    `${salutation} Em que posso te ajudar agora?`,
    `${salutation} Diga como posso te ajudar.`,
  ]);
}

function normalizeIntentText(value: string) {
  return textNormalizationService
    .expandContractions(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/[!?.,;:"]/g, " ")
    .replace(/\s+/g, " ");
}

function extractLocalIntentUtterance(value: string): string {
  const raw = `${value || ""}`.replace(/\r/g, "").trim();
  if (!raw) return "";

  const markerPatterns = [
    /\[user_input\]\s*:/gi,
    /mensagem do usuario\s*:/gi,
    /user message\s*:/gi,
    /^usuario\s*:/gim,
  ];

  for (const pattern of markerPatterns) {
    const matches = Array.from(raw.matchAll(pattern));
    if (!matches.length) continue;
    const last = matches[matches.length - 1];
    const tail = raw.slice((last.index || 0) + last[0].length).trim();
    if (tail) return tail;
  }

  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return raw;
  return lines[lines.length - 1];
}

function isGreetingPrompt(value: string) {
  const normalized = normalizeIntentText(value);
  const softened = normalized.replace(/[0-9]/g, "").replace(/\s+/g, " ").trim();
  if (!softened) return false;
  const greetingSet = new Set([
    "oi",
    "ola",
    "opa",
    "saudacoes",
    "e ai",
    "eae",
    "hey",
    "hello",
    "bom dia",
    "boa tarde",
    "boa noite",
  ]);
  return softened.length <= 48 && greetingSet.has(softened);
}

function isSmallTalkPrompt(value: string) {
  const normalized = normalizeIntentText(value);
  if (!normalized) return false;
  if (normalized.length > 80) return false;
  return (
    /\b(tudo bem(?: com (?:vc|voce|ce))?|td bem|tudo certo|tudo tranquilo)\b/.test(normalized) ||
    /\b(como (?:vc|voce|ce) (?:esta|ta)|como vai|que tal)\b/.test(normalized) ||
    /\b(beleza|blz|de boa|tranquilo|suave)\b/.test(normalized) ||
    /^(?:oi|ola|opa|saudacoes)\s+(?:tudo bem(?: com (?:vc|voce|ce))?|como vai|que tal)\b/.test(normalized)
  );
}

function buildSmallTalkFastReply(value: string) {
  const greetingPrefix = containsGreetingToken(value) ? `${resolveGreetingLead(value)} ` : "";
  return pickGreetingVariant(value, [
    `${greetingPrefix}Tudo certo por aqui. Como posso te ajudar agora?`,
    `${greetingPrefix}Tudo bem por aqui. Como posso te ajudar agora?`,
    `${greetingPrefix}Tudo tranquilo por aqui. Como posso te ajudar agora?`,
  ]);
}

function containsGreetingToken(value: string) {
  const normalized = normalizeIntentText(value);
  if (!normalized) return false;
  return /\b(oi|ola|opa|saudacoes|e ai|eae|hey|hello|bom dia|boa tarde|boa noite)\b/.test(normalized);
}

function resolveGreetingLead(value: string) {
  const normalized = normalizeIntentText(value);
  if (!normalized) return `${resolveClockGreetingLabel()}!`;
  if (/\bsaudacoes\b/.test(normalized)) return "Saudações!";
  if (/\bbom dia\b/.test(normalized)) return "Bom dia!";
  if (/\bboa tarde\b/.test(normalized)) return "Boa tarde!";
  if (/\bboa noite\b/.test(normalized)) return "Boa noite!";
  return `${resolveClockGreetingLabel()}!`;
}

function buildAssistantIdentityReply(value: string) {
  const greetingPrefix = containsGreetingToken(value) ? `${resolveGreetingLead(value)} ` : "";
  return `${greetingPrefix}Eu sou a Letícia.`;
}

function ensureAssistantNameFirst(answer: string) {
  const raw = `${answer || ""}`.trim();
  if (!raw) return "Meu nome é Letícia.";
  const normalized = normalizeIntentText(raw);
  if (/^(eu sou|meu nome e|eu me chamo|sou a leticia)\b/.test(normalized)) return raw;
  return `Meu nome é Letícia. ${raw}`;
}

type AssistantIdentityIntentFamily = "identity" | "name_semantics" | "creator_identity" | null;

function normalizeIntentHistoryWindow(history: RagChatHistoryItem[] | undefined, maxItems = 6) {
  if (!Array.isArray(history) || !history.length) return "";
  return history
    .slice(-maxItems)
    .map((row) => `${row?.content || ""}`.trim())
    .filter(Boolean)
    .map((row) => normalizeIntentText(row))
    .join(" ");
}

function resolveIdentityFamilyFromHistoryAnchor(history: RagChatHistoryItem[] | undefined): AssistantIdentityIntentFamily {
  if (!Array.isArray(history) || !history.length) return null;
  const rolePriority: Array<RagChatHistoryItem["role"]> = ["user", "assistant"];
  for (const role of rolePriority) {
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const item = history[index];
      if (!item || item.role !== role) continue;
      const content = `${item.content || ""}`.trim();
      if (!content) continue;
      const resolved = resolveIdentityFallbackForMessage(content);
      if (
        resolved.creatorQuestionDetected ||
        resolved.founderInfluenceQuestionDetected ||
        resolved.formationQuestionDetected ||
        resolved.professionalQuestionDetected
      ) {
        return "creator_identity";
      }
      if (resolved.nameOriginQuestionDetected) return "name_semantics";
      if (resolved.identityQuestionDetected) return "identity";
      const normalized = normalizeIntentText(content);
      if (/\b(medeiros|francimar|criador|idealizador|fundador)\b/.test(normalized)) return "creator_identity";
      if (/\b(origem|significado|conceito|definicao|nome leticia|te chamam assim)\b/.test(normalized)) {
        return "name_semantics";
      }
      if (/\b(quem e voce|como voce se chama|seu nome|eu sou a leticia)\b/.test(normalized)) return "identity";
    }
  }
  return null;
}

function hasAssistantIdentityContext(history: RagChatHistoryItem[] | undefined) {
  const normalized = normalizeIntentHistoryWindow(history);
  if (!normalized) return resolveIdentityFamilyFromHistoryAnchor(history) !== null;
  return (
    /\b(eu sou a leticia|meu nome e leticia)\b/.test(normalized) ||
    /\b(qual\s+(?:(?:e|eh|o)\s+)?(?:o\s+)?seu nome|como voce se chama|quem e voce)\b/.test(normalized) ||
    /\b(o que significa leticia|por que voce tem esse nome|de onde vem o nome leticia|de onde surgiu o nome leticia|conceito de leticia|definicao de leticia|base conceitual do nome leticia|como surgiu o nome leticia|ideia por tras do nome leticia)\b/.test(
      normalized,
    ) ||
    /\b(quem e medeiros|quem e o medeiros)\b/.test(normalized) ||
    resolveIdentityFamilyFromHistoryAnchor(history) !== null
  );
}

function hasCompetingTopicShift(normalized: string): boolean {
  if (!normalized) return false;
  return /\b(capital|presidente|governador|prefeito|colesterol|diabetes|sintoma|tratamento|docker|kubernetes|sql|api|codigo|ciencia|historia|geografia)\b/.test(
    normalized,
  );
}

function hasIdentityFollowUpCue(normalized: string): boolean {
  if (!normalized) return false;
  return /\b(esse mesmo|isso mesmo|sobre isso|fale mais|me diga mais|me conte mais|mais informacoes|mais detalhes|desse mesmo|sobre ele)\b/.test(
    normalized,
  );
}

function classifyAssistantIdentityIntentFamily(
  value: string,
  history?: RagChatHistoryItem[],
): AssistantIdentityIntentFamily {
  const identityFallback = resolveIdentityFallbackForMessage(value);
  if (identityFallback.shouldHandle) {
    if (
      identityFallback.creatorQuestionDetected ||
      identityFallback.founderInfluenceQuestionDetected ||
      identityFallback.formationQuestionDetected ||
      identityFallback.professionalQuestionDetected
    ) {
      return "creator_identity";
    }
    if (identityFallback.nameOriginQuestionDetected) return "name_semantics";
    if (identityFallback.identityQuestionDetected) return "identity";
  }

  const normalized = normalizeIntentText(value);
  if (!normalized) return null;

  const historyAnchorFamily = resolveIdentityFamilyFromHistoryAnchor(history);
  const hasHistoryAnchorFamily = historyAnchorFamily !== null;
  const hasIdentityContext = hasAssistantIdentityContext(history);
  const hasLeticia = /\bleticia\b/.test(normalized);
  const hasMedeiros = /\bmedeiros\b/.test(normalized);
  const hasTopicShift = hasCompetingTopicShift(normalized);
  const hasFollowUpReference = /\b(esse nome|esse significado|isso sobre o nome|isso do nome|isso|disso|isso ai|disso ai)\b/.test(normalized);
  const hasContinuationExplainCue =
    /\b((entao|e entao|ok|certo|beleza|humm?|hum+)\s*,?\s*)?(me\s+)?(explique|explica|detalhe|aprofunde|desenvolva|continue|fale mais|me diga mais|me conte mais)\b/.test(
      normalized,
    );
  const hasNameOriginByCalling = /\b((por que|porque|pq)\s+te\s+chamam\s+assim|te\s+chamam\s+assim)\b/.test(normalized);
  const hasCreatorFollowUpCue = /\b(mais\s+informacoes|mais\s+detalhes|fale\s+mais|me\s+diga\s+mais|me\s+conte\s+mais|quero\s+saber\s+mais|sobre\s+ele|sobre\s+esse|desse\s+medeiros|desse\s+mesmo)\b/.test(
    normalized,
  );
  const hasDirectIdentityCue =
    hasLeticia ||
    hasNameOriginByCalling ||
    /\b(seu nome|como voce se chama|quem e voce|quem eh voce|nome leticia|medeiros)\b/.test(normalized);
  const directedToAssistant =
    hasDirectIdentityCue ||
    /\b(voce|vc|seu|sua|teu|tua)\b/.test(normalized) ||
    /\b(quem (?:e|eh) (?:voce|vc)|e o seu|e qual (?:e|eh)? o seu)\b/.test(normalized) ||
    ((hasIdentityContext || hasHistoryAnchorFamily) && hasFollowUpReference);
  const directedToUserSelf = /\b(meu|minha)\s+nome\b/.test(normalized);
  if (!directedToAssistant && directedToUserSelf) return null;
  if (hasTopicShift && !hasLeticia && !hasMedeiros && !hasNameOriginByCalling) return null;

  const asksSemantics = /\b(significa|significado|quer dizer|sentido|representa|origem|de onde vem|por que|porque|pq|motivo|razao)\b/.test(
    normalized,
  );
  const asksConceptDefinition = /\b(conceito|definicao|base conceitual|de onde surgiu|surgiu de onde|historia do nome|ideia por tras)\b/.test(normalized);
  const asksCreatorIdentity = /\b(quem (?:e|eh)\s+(?:o\s+)?medeiros|e quem (?:e|eh)\s+medeiros|quem (?:e|eh)\s+esse\s+medeiros)\b/.test(
    normalized,
  );
  const asksCreatorExpansion = hasMedeiros && hasCreatorFollowUpCue;
  const mentionsName = /\b(nome|chama|chamar|chamam|te chamam|identidade|esse nome|leticia)\b/.test(normalized);

  if ((hasIdentityContext || hasHistoryAnchorFamily) && hasContinuationExplainCue && !hasTopicShift) {
    return historyAnchorFamily || (hasMedeiros ? "creator_identity" : mentionsName ? "name_semantics" : "identity");
  }

  if (hasHistoryAnchorFamily && normalized.length <= 90 && !hasTopicShift && /\b(entao|ok|certo|beleza|humm?|hum+|continue|explique|explica|detalhe|aprofunde|isso|disso)\b/.test(normalized)) {
    return historyAnchorFamily;
  }

  if (
    (asksCreatorIdentity || asksCreatorExpansion) &&
    (hasIdentityContext || hasDirectIdentityCue || hasFollowUpReference || /^e quem (?:e|eh)\s+medeiros\b/.test(normalized))
  ) {
    return "creator_identity";
  }
  if (hasIdentityContext && hasCreatorFollowUpCue && !hasTopicShift) {
    return "creator_identity";
  }
  if (
    directedToAssistant &&
    (asksSemantics || asksConceptDefinition) &&
    (mentionsName || hasLeticia || hasNameOriginByCalling || (hasIdentityContext && hasFollowUpReference))
  ) {
    return "name_semantics";
  }
  if (
    directedToAssistant &&
    (mentionsName || /\b(quem (?:e|eh) (?:voce|vc)|e o seu|e qual (?:e|eh)? o seu)\b/.test(normalized))
  ) {
    return "identity";
  }
  return null;
}

function buildAssistantNameSemanticsReply(value: string) {
  const fallback = resolveIdentityFallbackForMessage(value);
  if (fallback.shouldHandle) return ensureAssistantNameFirst(fallback.shortNarrative);

  const greetingPrefix = containsGreetingToken(value) ? `${resolveGreetingLead(value)} ` : "";
  return `${greetingPrefix}Eu sou a Letícia.`;
}

function buildAssistantCreatorReply(value: string) {
  const fallback = resolveIdentityFallbackForMessage(value);
  if (fallback.shouldHandle) return fallback.shortNarrative;

  const greetingPrefix = containsGreetingToken(value) ? `${resolveGreetingLead(value)} ` : "";
  return `${greetingPrefix}No contexto desta IA, Medeiros e o idealizador do projeto Leticia.`;
}

function buildAssistantIdentityClarificationReply(value: string) {
  const greetingPrefix = containsGreetingToken(value) ? `${resolveGreetingLead(value)} ` : "";
  return (
    `${greetingPrefix}Posso aprofundar, sim. Você quer mais detalhes sobre ` +
    "Medeiros (idealizador do projeto Letícia) ou sobre o significado do nome Letícia?"
  );
}

function resolveAssistantIdentityClarification(
  value: string,
  history?: RagChatHistoryItem[],
): string | null {
  const normalized = normalizeIntentText(value);
  if (!normalized) return null;
  if (!hasAssistantIdentityContext(history)) return null;
  if (!hasIdentityFollowUpCue(normalized)) return null;
  if (/\bleticia\b|\bmedeiros\b/.test(normalized)) return null;
  if (hasCompetingTopicShift(normalized)) return null;
  return buildAssistantIdentityClarificationReply(value);
}

function isClarificationCancelPrompt(value: string) {
  const normalized = normalizeIntentText(value);
  if (!normalized) return false;
  const hasCancelVerb =
    /\b(esqueca|ignora|ignore|desconsidere|cancele|cancelar|deixa pra la|nao use)\b/.test(normalized) ||
    /\b(esquecer|ignorar|desconsiderar)\b/.test(normalized);
  if (!hasCancelVerb) return false;
  return /\b(arquivo|documento|anexo|obra|pdf|isso|disso)\b/.test(normalized);
}

function parseWebSearchDirective(value: string): { query: string; preferPdf: boolean } | null {
  const raw = `${value || ""}`.trim();
  if (!raw) return null;
  const normalized = normalizeIntentText(raw);
  const hasSearchVerb = /\b(busque|buscar|pesquise|pesquisar|procure|procurar|encontre|encontrar|search)\b/.test(normalized);
  if (!hasSearchVerb) return null;
  const hasExplicitWebHint =
    /\b(na internet|na web|online|google)\b/.test(normalized) ||
    /^(pode|consegue|poderia)\s+(buscar|pesquisar|procurar|encontrar)\b/.test(normalized) ||
    /^(busque|buscar|pesquise|pesquisar|procure|procurar|encontre|encontrar|search)\b/.test(normalized);
  if (!hasExplicitWebHint) return null;

  const query = raw
    .replace(
      /^(?:por favor\s*)?(?:voce\s*)?(?:pode\s+|consegue\s+|poderia\s+)?(?:buscar|busque|pesquisar|pesquise|procurar|procure|encontrar|encontre|search)\b/i,
      "",
    )
    .replace(/^(?:\s+na\s+(?:internet|web)|\s+online|\s+no\s+google)\b/i, "")
    .replace(/^[\s:,-]+/, "")
    .trim();

  const preferPdf = /\bpdf\b/i.test(normalized);
  return {
    query: query.slice(0, 280),
    preferPdf,
  };
}

function formatWebSearchReply(payload: InternetSearchResponse, preferPdf: boolean) {
  const lines: string[] = [];
  lines.push(`Encontrei ${payload.results.length} resultado(s) na internet para: "${payload.query}".`);

  const pdfCount = payload.results.filter((item) => item.isPdf).length;
  if (preferPdf && pdfCount === 0) {
    lines.push("Não apareceu PDF direto nos primeiros resultados, mas estes links são os mais relevantes agora:");
  }

  payload.results.forEach((item, index) => {
    const title = item.title || `Resultado ${index + 1}`;
    const snippet = item.snippet ? ` - ${item.snippet}` : "";
    const pdfTag = item.isPdf ? " [PDF]" : "";
    lines.push(`${index + 1}. ${title}${pdfTag}`);
    lines.push(`${item.url}${snippet}`);
  });

  lines.push("Se quiser, eu refino a busca por idioma, periodo ou apenas fontes academicas.");
  return lines.join("\n");
}

function hasDocumentReferenceHint(value: string) {
  const normalized = normalizeIntentText(value);
  if (!normalized) return false;
  if (/\b(arquivo|documento|anexo|anexado|pdf|obra|texto|material)\b/.test(normalized)) return true;
  return /\b(essa|esse|esta|este|dessa|desse|desta|deste)\s+(obra|arquivo|documento|pdf|texto|material)\b/.test(
    normalized,
  );
}

function hasSingularDocumentReferenceHint(value: string) {
  const normalized = normalizeIntentText(value);
  if (!normalized) return false;
  return /\b(essa obra|esse arquivo|esse documento|este arquivo|este documento|dessa obra|desse arquivo|deste documento)\b/.test(
    normalized,
  );
}

function resolveScopedDocumentIdsForClarification(input: Pick<RagQueryInput, "documentId" | "documentIds">) {
  const scoped = normalizeDocumentIds(input.documentIds);
  const primary = normalizeDocumentId(input.documentId);
  if (primary && !scoped.includes(primary)) scoped.unshift(primary);
  return scoped.slice(0, 64);
}

function resolveDocumentClarificationReply(
  questionLike: string,
  input: Pick<RagQueryInput, "composerBound" | "documentId" | "documentIds">,
): LocalIntentReply | null {
  if (!hasDocumentReferenceHint(questionLike)) return null;
  const scopedIds = resolveScopedDocumentIdsForClarification(input);
  if (scopedIds.length === 0 && input.composerBound) {
    return {
      reason: "DOCUMENT_REFERENCE_MISSING",
      answer:
        "Você mencionou um arquivo/anexo, mas não encontrei documento em escopo nesta conversa. Pode reenviar o arquivo ou informar qual documento devo usar?",
    };
  }
  if (scopedIds.length > 1 && hasSingularDocumentReferenceHint(questionLike)) {
    return {
      reason: "DOCUMENT_REFERENCE_AMBIGUOUS",
      answer: `Você pediu sobre um único arquivo, mas há ${scopedIds.length} documentos no contexto. Qual deles devo usar?`,
    };
  }
  return null;
}

function resolveGroundingFallbackReply(
  error: unknown,
  input: Pick<RagQueryInput, "documentId" | "documentIds">,
): LocalIntentReply | null {
  if (!(error instanceof RagPipelineError)) return null;
  const scopedIds = resolveScopedDocumentIdsForClarification(input);
  if (!scopedIds.length) return null;
  const groundingCodes = new Set([
    "RAG_DOCUMENT_SCOPE_NO_HITS",
    "RAG_DOCUMENT_SCOPE_NOT_GROUNDED",
    "RAG_DOCUMENT_SCOPE_EMPTY_CONTEXT",
  ]);
  if (!groundingCodes.has(error.code)) return null;
  return {
    reason: "DOCUMENT_GROUNDING_REQUIRED",
    answer:
      "Não encontrei trechos suficientes do documento em escopo para responder com segurança. Você quer que eu resuma o arquivo inteiro agora?",
  };
}

type ScopedDocumentLabel = {
  id: number;
  title: string;
  sourcePath: string;
  fileName: string;
  labelNormalized: string;
};

function normalizeDocHint(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeDocHint(value: string) {
  return normalizeDocHint(value)
    .split(/\s+/g)
    .filter((token) => token.length >= 2);
}

function isAssistantDocumentClarificationPrompt(value: string) {
  const normalized = normalizeIntentText(value);
  if (!normalized) return false;
  return (
    /\bqual deles devo usar\b/.test(normalized) ||
    /\bqual documento devo usar\b/.test(normalized) ||
    /\bqual arquivo devo usar\b/.test(normalized)
  );
}

function extractClarificationParentQuestion(history: RagChatHistoryItem[] | undefined, currentMessage: string) {
  if (!Array.isArray(history) || !history.length) return "";
  const normalizedCurrent = normalizeIntentText(currentMessage);
  const rows = [...history];
  while (rows.length > 0) {
    const tail = rows[rows.length - 1];
    if (tail.role !== "user") break;
    if (normalizeIntentText(tail.content) !== normalizedCurrent) break;
    rows.pop();
  }
  let clarifierIndex = -1;
  for (let idx = rows.length - 1; idx >= 0; idx -= 1) {
    const row = rows[idx];
    if (row.role !== "assistant") continue;
    if (!isAssistantDocumentClarificationPrompt(row.content)) continue;
    clarifierIndex = idx;
    break;
  }
  if (clarifierIndex < 0) return "";
  for (let idx = clarifierIndex - 1; idx >= 0; idx -= 1) {
    const row = rows[idx];
    if (row.role !== "user") continue;
    const content = normalizeString(row.content);
    if (content) return content;
  }
  return "";
}

function resolveOrdinalDocumentHint(hint: string, scopedIds: number[]) {
  if (!scopedIds.length) return null;
  const normalized = normalizeDocHint(hint);
  if (!normalized) return null;
  const ordinalMap: Array<{ pattern: RegExp; index: number }> = [
    { pattern: /\b(1|primeiro|primeira)\b/, index: 0 },
    { pattern: /\b(2|segundo|segunda)\b/, index: 1 },
    { pattern: /\b(3|terceiro|terceira)\b/, index: 2 },
    { pattern: /\b(4|quarto|quarta)\b/, index: 3 },
    { pattern: /\b(5|quinto|quinta)\b/, index: 4 },
  ];
  for (const item of ordinalMap) {
    if (!item.pattern.test(normalized)) continue;
    if (item.index < scopedIds.length) return scopedIds[item.index];
    return null;
  }
  return null;
}

function scoreDocumentLabelMatch(hint: string, doc: ScopedDocumentLabel) {
  const normalizedHint = normalizeDocHint(hint);
  if (!normalizedHint) return 0;
  let score = 0;
  if (doc.labelNormalized.includes(normalizedHint)) score += 5;
  const hintTokens = tokenizeDocHint(normalizedHint).filter((token) => token.length >= 3);
  for (const token of hintTokens) {
    if (doc.labelNormalized.includes(token)) score += 1;
  }
  return score;
}

function buildDocumentSelectionPrompt(docs: ScopedDocumentLabel[]) {
  const options = docs
    .slice(0, 5)
    .map((doc, index) => `${index + 1}. ${doc.title || doc.fileName || `doc:${doc.id}`}`)
    .join("; ");
  return `Não consegui identificar qual documento você quis dizer. Escolha pelo número ou nome: ${options}`;
}

function buildClarificationGreetingReply(parentQuestion: string, currentQuestion: string) {
  const salutation = resolveGreetingLead(currentQuestion);
  const intro = `${salutation}`;
  const prompt = normalizeString(parentQuestion);
  if (!prompt) {
    return `${intro} Se quiser, continuo a solicitação anterior. Você quer que eu retome ou prefere um novo assunto?`;
  }
  return `${intro} Posso retomar seu pedido anterior ("${prompt}"). Você quer que eu continue ou prefere um novo assunto?`;
}

export class RagQueryService {
  private readonly generationConfig: RagGenerationConfig;
  private readonly contextConfig: { maxChars: number; maxChunks: number };
  private readonly resilienceConfig: RagResilienceConfig;
  private readonly pipelineFlags: RagPipelineFlags;
  private readonly latencyPreset: RagLatencyPreset;
  private readonly llmContextWindowTokens: number;
  private readonly safeOutputTokenCap: number;
  private readonly orchestratorV2: RagOrchestratorV2;
  private readonly vectorDb: VectorDatabaseClient;
  private readonly internetSearchService: RagInternetSearchService;
  private readonly routerStats: RouterStats = {
    total: 0,
    lite: 0,
    full: 0,
    fullNearLite: 0,
  };

  constructor(
    private readonly embeddingClient: QueryEmbeddingClient = createQueryEmbeddingClient(),
    private readonly retrievalService: RagRetrievalService = createRagRetrievalService(),
    private readonly llmClient: VllmInternalClient = createVllmInternalClient(),
    private readonly fullDocumentService: DocumentFullTextService = createDocumentFullTextService(),
    vectorDb: VectorDatabaseClient = createVectorDatabaseClient(),
    internetSearchService: RagInternetSearchService = createRagInternetSearchService(),
    options?: RagQueryServiceOptions,
  ) {
    this.vectorDb = options?.vectorDb ?? vectorDb;
    this.internetSearchService = options?.internetSearchService ?? internetSearchService;
    this.generationConfig = options?.generationConfig ?? loadRagGenerationConfig();
    this.contextConfig = options?.contextConfig ?? loadRagContextConfig();
    this.resilienceConfig = options?.resilienceConfig ?? loadRagResilienceConfig();
    this.pipelineFlags = options?.pipelineFlags ?? loadRagPipelineFlags();
    this.latencyPreset = options?.latencyPreset ?? parseLatencyPreset(process.env.RAG_LATENCY_PRESET);
    this.llmContextWindowTokens = resolveLlmContextWindowTokens();
    this.safeOutputTokenCap = resolveSafeOutputTokenCap(this.llmContextWindowTokens);
    this.orchestratorV2 = new RagOrchestratorV2(
      this.embeddingClient,
      undefined,
      this.llmClient,
      this.generationConfig,
      this.contextConfig,
      this.resilienceConfig,
      this.pipelineFlags,
    );
  }

  private resolvePipelineVersion(input: RagQueryInput): "v1" | "v2" {
    // Fluxo padrao fixo em v2 para garantir orquestracao multicall por solicitacao.
    void input;
    return "v2";
  }

  private isRoutingEnabled() {
    return parseOptionalBoolean(process.env.RAG_COMPLEXITY_ROUTER_ENABLED) !== false;
  }

  private resolveProcessingMode(
    input: RagQueryInput,
    routingText: string,
  ): { mode: RagProcessingMode; decision: ComplexityDecision } {
    const decision = routeComplexity({
      text: routingText,
      hasAttachments: normalizeDocumentIds(input.composerAttachmentIds).length > 0,
      hasDocumentScope:
        normalizeDocumentIds(input.documentIds).length > 0 || normalizeDocumentId(input.documentId) !== null,
      hasConversationContext: Array.isArray(input.history) && input.history.length > 0,
    });
    const forcedMode = parseProcessingMode(process.env.RAG_PIPELINE_FORCE_MODE);
    const requestedOverride = parseProcessingMode(input.pipelineModeOverride);
    if (requestedOverride) {
      return {
        mode: requestedOverride,
        decision: {
          ...decision,
          reasons: [...decision.reasons, `REQUEST_OVERRIDE:${requestedOverride.toUpperCase()}`],
        },
      };
    }
    if (!this.isRoutingEnabled()) {
      return {
        mode: forcedMode || "full",
        decision: {
          ...decision,
          reasons: [...decision.reasons, "ROUTER_DISABLED"],
        },
      };
    }
    if (forcedMode) {
      return {
        mode: forcedMode,
        decision: {
          ...decision,
          reasons: [...decision.reasons, `FORCED_MODE:${forcedMode.toUpperCase()}`],
        },
      };
    }
    return {
      mode: decision.mode,
      decision,
    };
  }

  private trackRouterStats(mode: RagProcessingMode, decision: ComplexityDecision, requestId: string | null) {
    this.routerStats.total += 1;
    this.routerStats[mode] += 1;
    if (mode === "full" && !decision.hardRule && decision.score <= 2) {
      this.routerStats.fullNearLite += 1;
    }
    GLOBAL_ROUTER_STATS.total += 1;
    GLOBAL_ROUTER_STATS[mode] += 1;
    if (mode === "full" && !decision.hardRule && decision.score <= 2) {
      GLOBAL_ROUTER_STATS.fullNearLite += 1;
    }
    if (this.routerStats.total % 25 === 0) {
      const snapshot = toRouterStatsSnapshot(this.routerStats);
      logger.info("RAG_ROUTER_STATS_SNAPSHOT", {
        requestId,
        ...snapshot,
      });
    }
  }

  private resolveLiteHistory(history: RagChatHistoryItem[] | undefined) {
    const maxMessages = parsePositiveInt(process.env.RAG_LITE_HISTORY_MAX_MESSAGES, 2, 0, 8);
    const maxChars = parsePositiveInt(process.env.RAG_LITE_HISTORY_MAX_CHARS, 1200, 0, 4000);
    return normalizeHistory(history, {
      ...this.generationConfig,
      historyMaxMessages: maxMessages,
      historyMaxChars: maxChars,
    });
  }

  private resolveAnmRoutingInput(input: RagQueryInput) {
    return {
      anmEngineMode: input.anmEngineMode,
      anmBaseUrl: input.anmBaseUrl,
      anmTimeoutMs: input.anmTimeoutMs,
      anmSoftTimeoutMs: input.anmSoftTimeoutMs,
      anmFallbackToDirect: input.anmFallbackToDirect,
    };
  }

  private resolveLiteTokens(requestedMaxTokens: number) {
    const liteCap = parsePositiveInt(process.env.RAG_LITE_MAX_TOKENS, 192, 64, 2048);
    return Math.max(64, Math.min(requestedMaxTokens, liteCap));
  }

  private resolveMaxResponseTokens(input: RagQueryInput, mode: "lite" | "full", requestId: string | null) {
    const requested = clampMaxTokens(input.maxResponseTokens, this.generationConfig.maxTokens);
    if (mode === "lite") return this.resolveLiteTokens(requested);

    const clampEnabled = parseOptionalBoolean(process.env.RAG_SAFE_OUTPUT_CLAMP_ENABLED) !== false;
    if (!clampEnabled) return requested;

    const normalized = Math.max(64, Math.min(requested, this.safeOutputTokenCap));
    if (normalized < requested) {
      logger.warn("RAG_SAFE_OUTPUT_TOKEN_CLAMP", {
        requestId,
        requestedMaxTokens: requested,
        clampedMaxTokens: normalized,
        safeOutputTokenCap: this.safeOutputTokenCap,
        llmContextWindowTokens: this.llmContextWindowTokens,
      });
    }
    return normalized;
  }

  private resolveLiteTemperature(fallback: number) {
    const raw = Number(process.env.RAG_LITE_TEMPERATURE);
    if (Number.isFinite(raw)) return Math.max(0, Math.min(2, raw));
    return fallback;
  }

  private shouldUseLocalIntentFastPath() {
    if (parseOptionalBoolean(process.env.RAG_LOCAL_INTENT_FAST_PATH_ENABLED) === false) return false;
    const llmBridgeAlwaysOn = parseOptionalBoolean(process.env.AI_SYSTEM_LLM_BRIDGE_ALWAYS_ON) !== false;
    const allowWithAlwaysOn = parseOptionalBoolean(process.env.RAG_ALLOW_LOCAL_INTENT_FAST_PATH_WITH_LLM_BRIDGE) === true;
    if (llmBridgeAlwaysOn && !allowWithAlwaysOn) return false;
    return true;
  }

  private toPlainTextStream(answer: string): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(answer));
        controller.close();
      },
    });
  }

  private toProducerChunkedStream(
    producer: () => Promise<string>,
    chunkSize = 240,
  ): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const safeChunkSize = Math.max(48, Math.min(2048, Math.trunc(chunkSize)));
    return new ReadableStream<Uint8Array>({
      start: async (controller) => {
        try {
          const answer = `${(await producer()) || ""}`;
          let cursor = 0;
          const emit = () => {
            if (cursor >= answer.length) {
              controller.close();
              return;
            }
            const nextCursor = Math.min(answer.length, cursor + safeChunkSize);
            const chunk = answer.slice(cursor, nextCursor);
            cursor = nextCursor;
            controller.enqueue(encoder.encode(chunk));
            setTimeout(emit, 0);
          };
          emit();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  private canDegradeFromEmbeddingError(error: unknown) {
    if (this.resilienceConfig.embeddingFailureMode !== "degrade") return false;
    if (!(error instanceof RagPipelineError)) return false;
    return error.code.startsWith("RAG_EMBEDDING_");
  }

  private canDegradeFromRetrievalError(error: unknown) {
    if (this.resilienceConfig.embeddingFailureMode !== "degrade") return false;
    if (!(error instanceof RagPipelineError)) return false;
    return error.code === "RAG_RETRIEVAL_ERROR";
  }

  private buildDegradedPreparation(
    input: RagQueryInput,
    opts: {
      code: string;
      message: string;
      requestId: string | null;
      embedding: { model: string; dimension: number; elapsedMs: number };
    },
  ): QueryPreparationResult {
    const fallbackDocumentIds = normalizeDocumentIds(input.documentIds);
    const fallbackDocumentId = normalizeDocumentId(input.documentId);
    const fullDocumentSeedIds = fallbackDocumentIds.length
      ? fallbackDocumentIds
      : fallbackDocumentId
        ? [fallbackDocumentId]
        : [];
    logger.warn("RAG_QUERY_DEGRADED_NO_VECTOR_CONTEXT", {
      requestId: opts.requestId,
      code: opts.code,
      message: opts.message,
      embeddingModel: opts.embedding.model,
      usedDocumentScopeFallback: fullDocumentSeedIds.length > 0,
      failureMode: this.resilienceConfig.embeddingFailureMode,
    });

    return {
      retrieval: buildEmptyRetrievalResult(input),
      embedding: opts.embedding,
      appliedRetrievalModelFilter: "",
      degradation: {
        degraded: true,
        code: opts.code,
        message: opts.message,
        usedDocumentScopeFallback: fullDocumentSeedIds.length > 0,
      },
      fullDocumentSeedIds,
    };
  }

  private async prepareQuery(input: RagQueryInput, question: string): Promise<QueryPreparationResult> {
    const requestId = input.requestId || null;
    const sourceType = normalizeString(input.sourceType) || undefined;
    const scopedDocumentIds = normalizeDocumentIds(input.documentIds);
    const explicitRetrievalModelFilter = normalizeString(input.retrievalEmbeddingModel);
    const embeddingStartedAt = Date.now();

    let embeddingResult: Awaited<ReturnType<QueryEmbeddingClient["embedQuery"]>>;
    try {
      embeddingResult = await this.embeddingClient.embedQuery(question);
    } catch (error) {
      if (!this.canDegradeFromEmbeddingError(error)) throw error;
      const pipelineError = error as RagPipelineError;
      return this.buildDegradedPreparation(input, {
        code: pipelineError.code,
        message: pipelineError.message,
        requestId,
        embedding: {
          model: "unavailable",
          dimension: this.embeddingClient.getConfig().expectedDimension,
          elapsedMs: Date.now() - embeddingStartedAt,
        },
      });
    }

    let appliedRetrievalModelFilter = explicitRetrievalModelFilter || embeddingResult.model;
    try {
      let retrieval = await this.retrievalService.search({
        queryVector: embeddingResult.vector,
        topK: input.topK,
        maxDistance: input.maxDistance,
        documentId: input.documentId,
        documentIds: scopedDocumentIds,
        sourceType,
        embeddingModel: appliedRetrievalModelFilter || undefined,
      });

      if (!retrieval.hits.length && !explicitRetrievalModelFilter) {
        logger.warn("RAG_QUERY_RETRIEVAL_MODEL_FALLBACK", {
          requestId,
          queryEmbeddingModel: embeddingResult.model,
          reason: "zero_hits_with_model_filter",
        });
        retrieval = await this.retrievalService.search({
          queryVector: embeddingResult.vector,
          topK: input.topK,
          maxDistance: input.maxDistance,
          documentId: input.documentId,
          documentIds: scopedDocumentIds,
          sourceType,
        });
        appliedRetrievalModelFilter = "";
      }

      return {
        retrieval,
        embedding: {
          model: embeddingResult.model,
          dimension: embeddingResult.dimension,
          elapsedMs: embeddingResult.elapsedMs,
        },
        appliedRetrievalModelFilter,
        degradation: {
          degraded: false,
          code: null,
          message: null,
          usedDocumentScopeFallback: false,
        },
        fullDocumentSeedIds: [],
      };
    } catch (error) {
      if (!this.canDegradeFromRetrievalError(error)) throw error;
      const pipelineError = error as RagPipelineError;
      return this.buildDegradedPreparation(input, {
        code: pipelineError.code,
        message: pipelineError.message,
        requestId,
        embedding: {
          model: embeddingResult.model,
          dimension: embeddingResult.dimension,
          elapsedMs: embeddingResult.elapsedMs,
        },
      });
    }
  }

  private async runLiteQuery(input: RagQueryInput, question: string, requestId: string | null): Promise<RagQueryResult> {
    const startedAt = Date.now();
    const liteQuestion = normalizeString(input.routingHint) || question;
    const identitySharedMemory = await resolveIdentityRuntimeSharedContext();
    const identityContextPack = identitySharedMemory.promptBlock || "";
    const history = this.resolveLiteHistory(input.history);
    const maxTokens = this.resolveMaxResponseTokens(input, "lite", requestId);
    const temperature = this.resolveLiteTemperature(clampTemperature(input.temperature, this.generationConfig.temperature));
    const llmResult = await this.llmClient.completeWithContext({
      question: liteQuestion,
      contextPack: identityContextPack,
      history,
      maxTokens,
      temperature,
      seed: normalizeSeed(input.seed, this.generationConfig.seed),
      runtimeMode: "lite",
      responseLanguageId: input.preferredResponseLanguageId,
      ...this.resolveAnmRoutingInput(input),
    });
    const totalMs = Date.now() - startedAt;
    logger.info("RAG_LITE_QUERY_DONE", {
      requestId,
      answerChars: llmResult.answer.length,
      maxTokens,
      historyItems: history.length,
      identitySharedMemoryStatus: identitySharedMemory.status,
      identitySharedMemoryChars: identityContextPack.length,
      llmElapsedMs: llmResult.elapsedMs,
      totalMs,
    });
    return {
      answer: llmResult.answer,
      metadata: {
        resilience: {
          embeddingFailureMode: this.resilienceConfig.embeddingFailureMode,
          degraded: false,
          degradedCode: null,
          degradedMessage: null,
          usedDocumentScopeFallback: false,
        },
        retrieval: {
          topK: 0,
          maxDistance: null,
          strategy: "cosine",
          filters: {
            documentId: null,
            documentIds: [],
            sourceType: null,
            embeddingModel: null,
          },
          returnedChunks: 0,
        },
        contextPack: {
          selectedChunks: identityContextPack ? 1 : 0,
          omittedChunks: 0,
          totalCandidateChunks: identityContextPack ? 1 : 0,
          maxChars: identityContextPack.length,
          usedChars: identityContextPack.length,
          truncated: false,
        },
        fullDocumentRead: {
          enabled: false,
          attemptedDocs: 0,
          loadedDocs: 0,
          contextDocs: 0,
          failedDocs: 0,
          fullReadChars: 0,
          includedChars: 0,
          truncatedDocs: 0,
          sources: [],
        },
        chunks: [],
        queryEmbedding: {
          model: "skipped_lite_mode",
          dimension: 0,
        },
        llm: {
          provider: "vllm_internal",
          baseUrl: this.llmClient.getConfig().baseUrl,
          model: llmResult.model,
          runtimeMode: "lite",
          maxTokens,
          temperature,
          seed: normalizeSeed(input.seed, this.generationConfig.seed),
          finishReason: llmResult.finishReason,
          usage: llmResult.usage,
        },
        timingsMs: {
          embedding: 0,
          retrieval: 0,
          contextAssembly: 0,
          llm: llmResult.elapsedMs,
          total: totalMs,
        },
      },
    };
  }

  private async runLiteStream(input: RagQueryInput, question: string, requestId: string | null) {
    const liteQuestion = normalizeString(input.routingHint) || question;
    const identitySharedMemory = await resolveIdentityRuntimeSharedContext();
    const identityContextPack = identitySharedMemory.promptBlock || "";
    const history = this.resolveLiteHistory(input.history);
    const maxTokens = this.resolveMaxResponseTokens(input, "lite", requestId);
    const temperature = this.resolveLiteTemperature(clampTemperature(input.temperature, this.generationConfig.temperature));
    logger.info("RAG_LITE_STREAM_READY", {
      requestId,
      questionChars: liteQuestion.length,
      maxTokens,
      historyItems: history.length,
      identitySharedMemoryStatus: identitySharedMemory.status,
      identitySharedMemoryChars: identityContextPack.length,
    });
    return this.llmClient.streamWithContext({
      question: liteQuestion,
      contextPack: identityContextPack,
      history,
      maxTokens,
      temperature,
      seed: normalizeSeed(input.seed, this.generationConfig.seed),
      runtimeMode: "lite",
      responseLanguageId: input.preferredResponseLanguageId,
      ...this.resolveAnmRoutingInput(input),
    });
  }

  private async loadScopedDocumentLabels(scopedIds: number[]): Promise<ScopedDocumentLabel[]> {
    const safeIds = Array.from(new Set(scopedIds.map((row) => Math.trunc(Number(row))).filter((row) => row > 0))).slice(0, 64);
    if (!safeIds.length) return [];
    try {
      const { rows } = await this.vectorDb.query<{
        id: string | number;
        title: string | null;
        source_path: string | null;
        original_filename: string | null;
      }>(
        `
        select d.id, d.title, d.source_path, d.original_filename
        from vector_store.documents d
        where d.id = any($1::int[])
        `,
        [safeIds],
      );
      const byId = new Map<number, ScopedDocumentLabel>();
      for (const row of rows) {
        const id = Number(row.id);
        if (!Number.isFinite(id) || id <= 0) continue;
        const sourcePath = normalizeString(row.source_path || "");
        const fileName = normalizeString(row.original_filename || path.basename(sourcePath || ""));
        const title = normalizeString(row.title || fileName || `documento-${id}`);
        const labelNormalized = normalizeDocHint([title, fileName, sourcePath].filter(Boolean).join(" "));
        byId.set(Math.trunc(id), {
          id: Math.trunc(id),
          title,
          sourcePath,
          fileName,
          labelNormalized,
        });
      }
      return safeIds
        .map((id) => byId.get(id))
        .filter((row): row is ScopedDocumentLabel => Boolean(row));
    } catch {
      return safeIds.map((id) => ({
        id,
        title: `documento-${id}`,
        sourcePath: `documento-${id}`,
        fileName: `documento-${id}`,
        labelNormalized: normalizeDocHint(`documento-${id}`),
      }));
    }
  }

  private async resolveClarificationContinuation(input: {
    question: string;
    effectiveInput: RagQueryInput;
  }): Promise<
    | {
        semanticQuestion: string;
        effectiveInput: RagQueryInput;
      }
    | {
        localReply: LocalIntentReply;
      }
    | null
  > {
    const question = normalizeString(input.question);
    const effectiveInput = input.effectiveInput;
    if (!question) return null;
    const scopedIds = resolveScopedDocumentIdsForClarification({
      documentId: effectiveInput.documentId,
      documentIds: effectiveInput.documentIds,
    });
    if (scopedIds.length <= 1) return null;
    if (question.length > 160) return null;

    const parentQuestion = extractClarificationParentQuestion(effectiveInput.history, question);
    if (!parentQuestion) return null;
    if (isGreetingPrompt(question)) {
      return {
        localReply: {
          reason: "GREETING_FAST_PATH",
          answer: buildClarificationGreetingReply(parentQuestion, question),
        },
      };
    }
    if (isClarificationCancelPrompt(question)) {
      const answer = containsGreetingToken(question)
        ? `${resolveGreetingLead(question)} Perfeito, vou ignorar esse documento. Como posso ajudar agora?`
        : "Perfeito, vou ignorar esse documento. Como posso ajudar agora?";
      return {
        localReply: {
          reason: "DOCUMENT_REFERENCE_CANCELLED",
          answer,
        },
      };
    }

    const ordinalChoice = resolveOrdinalDocumentHint(question, scopedIds);
    let selectedDocId: number | null = ordinalChoice;
    let bestScore = 0;
    let secondBestScore = 0;
    const docs = await this.loadScopedDocumentLabels(scopedIds);
    if (!selectedDocId) {
      let bestId: number | null = null;
      for (const doc of docs) {
        const score = scoreDocumentLabelMatch(question, doc);
        if (score > bestScore) {
          secondBestScore = bestScore;
          bestScore = score;
          bestId = doc.id;
        } else if (score > secondBestScore) {
          secondBestScore = score;
        }
      }
      if (bestId && bestScore > 0 && bestScore > secondBestScore) {
        selectedDocId = bestId;
      }
    }

    if (!selectedDocId) {
      // Regra de dominancia do texto atual:
      // se a nova mensagem nao se vincula diretamente a selecao de documento,
      // nao insistir na pendencia anterior.
      if (!hasDocumentReferenceHint(question) && bestScore <= 0) {
        return null;
      }
      return {
        localReply: {
          reason: "DOCUMENT_REFERENCE_AMBIGUOUS",
          answer: buildDocumentSelectionPrompt(docs),
        },
      };
    }

    const selectedDoc = docs.find((row) => row.id === selectedDocId) || null;
    const semanticQuestion = parentQuestion;
    const adjustedInput: RagQueryInput = {
      ...effectiveInput,
      routingHint: semanticQuestion,
      documentId: selectedDocId,
      documentIds: [selectedDocId],
      priorityDocumentIds: [selectedDocId],
      strictDocumentGrounding: true,
    };
    logger.info("RAG_DOCUMENT_CLARIFICATION_RESOLVED", {
      requestId: effectiveInput.requestId || null,
      selectedDocId,
      selectedDocTitle: selectedDoc?.title || null,
      parentQuestionChars: semanticQuestion.length,
    });
    return {
      semanticQuestion,
      effectiveInput: adjustedInput,
    };
  }

  private buildLocalResult(input: RagQueryInput, answer: string, reason: LocalIntentReply["reason"]): RagQueryResult {
    const totalMs = 1;
    return {
      answer,
      metadata: {
        resilience: {
          embeddingFailureMode: this.resilienceConfig.embeddingFailureMode,
          degraded: false,
          degradedCode: null,
          degradedMessage: null,
          usedDocumentScopeFallback: false,
        },
        retrieval: {
          topK: 0,
          maxDistance: null,
          strategy: "cosine",
          filters: {
            documentId: null,
            documentIds: [],
            sourceType: null,
            embeddingModel: null,
          },
          returnedChunks: 0,
        },
        contextPack: {
          selectedChunks: 0,
          omittedChunks: 0,
          totalCandidateChunks: 0,
          maxChars: 0,
          usedChars: 0,
          truncated: false,
        },
        fullDocumentRead: {
          enabled: false,
          attemptedDocs: 0,
          loadedDocs: 0,
          contextDocs: 0,
          failedDocs: 0,
          fullReadChars: 0,
          includedChars: 0,
          truncatedDocs: 0,
          sources: [],
        },
        chunks: [],
        queryEmbedding: {
          model: "skipped_local_intent",
          dimension: 0,
        },
        llm: {
          provider: "vllm_internal",
          baseUrl: this.llmClient.getConfig().baseUrl,
          model: `local_intent:${reason.toLowerCase()}`,
          runtimeMode: "lite",
          maxTokens: this.resolveMaxResponseTokens(input, "lite", null),
          temperature: this.resolveLiteTemperature(clampTemperature(input.temperature, this.generationConfig.temperature)),
          seed: normalizeSeed(input.seed, this.generationConfig.seed),
          finishReason: "stop",
          usage: {
            promptTokens: 0,
            completionTokens: Math.max(1, Math.ceil(answer.length / 4)),
            totalTokens: Math.max(1, Math.ceil(answer.length / 4)),
          },
        },
        timingsMs: {
          embedding: 0,
          retrieval: 0,
          contextAssembly: 0,
          llm: totalMs,
          total: totalMs,
        },
      },
    };
  }

  private async resolveLocalIntentReply(
    questionLike: string,
    history?: RagChatHistoryItem[],
  ): Promise<LocalIntentReply | null> {
    const intentUtterance = extractLocalIntentUtterance(questionLike);
    const assistantIdentityIntent = classifyAssistantIdentityIntentFamily(intentUtterance, history);
    if (assistantIdentityIntent === "creator_identity") {
      return {
        reason: "ASSISTANT_CREATOR_FAST_PATH",
        answer: buildAssistantCreatorReply(intentUtterance),
      };
    }
    if (assistantIdentityIntent === "name_semantics") {
      return {
        reason: "ASSISTANT_NAME_SEMANTICS_FAST_PATH",
        answer: buildAssistantNameSemanticsReply(intentUtterance),
      };
    }
    if (assistantIdentityIntent === "identity") {
      return {
        reason: "ASSISTANT_IDENTITY_FAST_PATH",
        answer: buildAssistantIdentityReply(intentUtterance),
      };
    }

    if (isGreetingPrompt(intentUtterance)) {
      return {
        reason: "GREETING_FAST_PATH",
        answer: buildGreetingFastReply(intentUtterance),
      };
    }
    if (isSmallTalkPrompt(intentUtterance)) {
      return {
        reason: "SMALL_TALK_FAST_PATH",
        answer: buildSmallTalkFastReply(intentUtterance),
      };
    }

    const identityClarification = resolveAssistantIdentityClarification(intentUtterance, history);
    if (identityClarification) {
      return {
        reason: "ASSISTANT_IDENTITY_AMBIGUOUS",
        answer: identityClarification,
      };
    }

    const searchDirective = parseWebSearchDirective(intentUtterance);
    if (!searchDirective) return null;
    if (!this.internetSearchService.isEnabled()) {
      return {
        reason: "WEB_SEARCH_UNAVAILABLE",
        answer:
          "Consigo buscar na internet, mas essa função está desativada no servidor agora. Peça ao administrador para habilitar a busca externa.",
      };
    }
    if (!searchDirective.query) {
      return {
        reason: "WEB_SEARCH_NO_QUERY",
        answer: "Posso buscar, sim. Me diga o tema ou termo exato, por exemplo: \"busque PDF sobre perspectiva heliocentrica\".",
      };
    }

    const payload = await this.internetSearchService.search({
      query: searchDirective.query,
      preferPdf: searchDirective.preferPdf,
    });
    if (!payload || !payload.results.length) {
      return {
        reason: "WEB_SEARCH_UNAVAILABLE",
        answer:
          "Não encontrei resultados agora para essa busca. Tente termos mais específicos (autor, ano, tema) ou peça para eu focar em PDF acadêmico.",
      };
    }

    return {
      reason: "WEB_SEARCH_RESULT",
      answer: formatWebSearchReply(payload, searchDirective.preferPdf),
    };
  }

  async query(input: RagQueryInput): Promise<RagQueryResult> {
    const contract = buildComposerRagContract({
      question: input.question,
      documentId: input.documentId,
      documentIds: input.documentIds,
      composerBound: input.composerBound,
      composerAttachmentIds: input.composerAttachmentIds,
      preferredResponseLanguageId: input.preferredResponseLanguageId,
      strictDocumentGrounding: input.strictDocumentGrounding,
    });
    const effectiveInput: RagQueryInput = {
      ...input,
      question: contract.question,
      composerBound: contract.composerBound,
      scopeMode: contract.scopeMode,
      documentId: contract.documentId,
      documentIds: contract.documentIds,
      priorityDocumentIds: contract.priorityDocumentIds,
      strictDocumentGrounding: contract.strictDocumentGrounding,
      preferredResponseLanguageId: contract.preferredResponseLanguageId,
    };
    const question = contract.question;

    logger.info("RAG_COMPOSER_CONTRACT_APPLIED", {
      requestId: effectiveInput.requestId || null,
      composerBound: contract.composerBound,
      strictDocumentGrounding: contract.strictDocumentGrounding,
      hasDocumentScope: contract.hasDocumentScope,
      scopeMode: contract.scopeMode,
      scopeSource: contract.scopeSource,
      documentId: contract.documentId ?? null,
      documentIds: contract.documentIds,
      priorityDocumentIds: contract.priorityDocumentIds,
      preferredResponseLanguageId: contract.preferredResponseLanguageId || null,
    });

    const requestId = effectiveInput.requestId || null;
    const routingText = normalizeString(effectiveInput.routingHint) || question;
    let semanticQuestion = routingText;
    let runtimeInput = effectiveInput;
    const continuation = await this.resolveClarificationContinuation({
      question: routingText,
      effectiveInput: runtimeInput,
    });
    if (continuation) {
      if ("localReply" in continuation) {
        return this.buildLocalResult(runtimeInput, continuation.localReply.answer, continuation.localReply.reason);
      }
      runtimeInput = continuation.effectiveInput;
      semanticQuestion = continuation.semanticQuestion;
    }
    const clarification = resolveDocumentClarificationReply(semanticQuestion, {
      composerBound: runtimeInput.composerBound,
      documentId: runtimeInput.documentId,
      documentIds: runtimeInput.documentIds,
    });
    if (clarification) {
      logger.info("RAG_DOCUMENT_REFERENCE_CLARIFICATION", {
        requestId,
        reason: clarification.reason,
        textChars: semanticQuestion.length,
      });
      return this.buildLocalResult(runtimeInput, clarification.answer, clarification.reason);
    }
    if (this.shouldUseLocalIntentFastPath()) {
      const localIntent = await this.resolveLocalIntentReply(semanticQuestion, runtimeInput.history);
      if (localIntent) {
        logger.info("RAG_LOCAL_INTENT_REPLY", {
          requestId,
          reason: localIntent.reason,
          textChars: semanticQuestion.length,
        });
        return this.buildLocalResult(runtimeInput, localIntent.answer, localIntent.reason);
      }
    }
    const routed = this.resolveProcessingMode(runtimeInput, semanticQuestion);
    this.trackRouterStats(routed.mode, routed.decision, requestId);
    const promptTokensEst = Math.max(1, Math.ceil(semanticQuestion.length / 4));
    logger.info("RAG_COMPLEXITY_ROUTER_DECISION", {
      requestId,
      mode: routed.mode,
      score: routed.decision.score,
      hardRule: routed.decision.hardRule,
      reasons: routed.decision.reasons,
      policyOverrides: routed.decision.policyOverrides,
      textChars: routed.decision.textChars,
      textWords: routed.decision.textWords,
      promptTokensEst,
    });

    if (routed.mode === "lite") {
      return this.runLiteQuery(runtimeInput, semanticQuestion, requestId);
    }

    const effectiveMaxResponseTokens = this.resolveMaxResponseTokens(runtimeInput, "full", requestId);
    const pipelineVersion = this.resolvePipelineVersion(runtimeInput);
    if (pipelineVersion === "v2") {
      const history = normalizeHistory(runtimeInput.history, this.generationConfig);
      let v2Result;
      try {
        v2Result = await this.orchestratorV2.query({
          requestId: runtimeInput.requestId || `ragv2-${Date.now()}`,
          question: semanticQuestion,
          history,
          topK: runtimeInput.topK,
          maxDistance: runtimeInput.maxDistance,
          documentId: runtimeInput.documentId,
          documentIds: runtimeInput.documentIds,
          priorityDocumentIds: runtimeInput.priorityDocumentIds,
          sourceType: runtimeInput.sourceType,
          retrievalEmbeddingModel: runtimeInput.retrievalEmbeddingModel,
          preferredResponseLanguageId: runtimeInput.preferredResponseLanguageId,
          strictDocumentGrounding: runtimeInput.strictDocumentGrounding,
          maxResponseTokens: effectiveMaxResponseTokens,
          temperature: runtimeInput.temperature,
          seed: runtimeInput.seed,
          anmEngineMode: runtimeInput.anmEngineMode,
          anmBaseUrl: runtimeInput.anmBaseUrl,
          anmTimeoutMs: runtimeInput.anmTimeoutMs,
          anmSoftTimeoutMs: runtimeInput.anmSoftTimeoutMs,
          anmFallbackToDirect: runtimeInput.anmFallbackToDirect,
        });
      } catch (error) {
        const groundingFallback = resolveGroundingFallbackReply(error, {
          documentId: runtimeInput.documentId,
          documentIds: runtimeInput.documentIds,
        });
        if (groundingFallback) {
          logger.warn("RAG_DOCUMENT_GROUNDING_FALLBACK", {
            requestId,
            reason: groundingFallback.reason,
            errorCode: error instanceof RagPipelineError ? error.code : null,
          });
          return this.buildLocalResult(runtimeInput, groundingFallback.answer, groundingFallback.reason);
        }
        throw error;
      }
      return {
        answer: v2Result.answer,
        metadata: {
          ...v2Result.metadata,
          llm: {
            ...v2Result.metadata.llm,
            runtimeMode: "full",
          },
          contextPack: {
            ...v2Result.metadata.contextPack,
            totalCandidateChunks:
              v2Result.metadata.contextPack.selectedChunks + v2Result.metadata.contextPack.omittedChunks,
          },
          chunks: [],
        },
      };
    }

    const startedAt = Date.now();
    logger.info("RAG_QUERY_START", {
      requestId: runtimeInput.requestId || null,
      questionChars: semanticQuestion.length,
      topK: runtimeInput.topK,
      sourceType: runtimeInput.sourceType || null,
      documentId: runtimeInput.documentId ?? null,
      documentIds: normalizeDocumentIds(runtimeInput.documentIds),
    });

    const prepared = await this.prepareQuery(runtimeInput, semanticQuestion);
    const retrieval = prepared.retrieval;
    const appliedRetrievalModelFilter = prepared.appliedRetrievalModelFilter;

    const contextAssemblyStartedAt = Date.now();
    const contextPack = assembleContextPack({
      hits: retrieval.hits,
      maxChars: this.contextConfig.maxChars,
      maxChunks: this.contextConfig.maxChunks,
    });
    const fullDocContext =
      prepared.fullDocumentSeedIds.length > 0
        ? await this.fullDocumentService.buildContextFromDocumentIds(prepared.fullDocumentSeedIds)
        : await this.fullDocumentService.buildContextFromHits(retrieval.hits);
    const identitySharedMemory = await resolveIdentityRuntimeSharedContext();
    const identityContextPack = identitySharedMemory.promptBlock || "";
    const combinedContextRaw = [identityContextPack, contextPack.text, fullDocContext.text].filter(Boolean).join("\n\n");
    const fullContextCap = parsePositiveInt(
      process.env.RAG_FULL_CONTEXT_MAX_CHARS,
      Math.max(this.contextConfig.maxChars, 15_000),
      2_000,
      80_000,
    );
    const combinedContext =
      combinedContextRaw.length > fullContextCap ? combinedContextRaw.slice(0, fullContextCap) : combinedContextRaw;
    const contextAssemblyMs = Date.now() - contextAssemblyStartedAt;

    const history = normalizeHistory(runtimeInput.history, this.generationConfig);
    const llmResult = await this.llmClient.completeWithContext({
      question: semanticQuestion,
      contextPack: combinedContext,
      history,
      maxTokens: effectiveMaxResponseTokens,
      temperature: clampTemperature(runtimeInput.temperature, this.generationConfig.temperature),
      seed: normalizeSeed(runtimeInput.seed, this.generationConfig.seed),
      ...this.resolveAnmRoutingInput(runtimeInput),
    });

    const metadata: RagQueryResult["metadata"] = {
      resilience: {
        embeddingFailureMode: this.resilienceConfig.embeddingFailureMode,
        degraded: prepared.degradation.degraded,
        degradedCode: prepared.degradation.code,
        degradedMessage: prepared.degradation.message,
        usedDocumentScopeFallback: prepared.degradation.usedDocumentScopeFallback,
      },
      retrieval: {
        topK: retrieval.params.topK,
        maxDistance: retrieval.params.maxDistance,
        strategy: retrieval.params.strategy,
        filters: {
          documentId: runtimeInput.documentId ?? null,
          documentIds: normalizeDocumentIds(runtimeInput.documentIds),
          sourceType: normalizeString(runtimeInput.sourceType) || null,
          embeddingModel: appliedRetrievalModelFilter || null,
        },
        returnedChunks: retrieval.hits.length,
      },
      contextPack: {
        selectedChunks: contextPack.chunks.length,
        omittedChunks: contextPack.omittedChunks,
        totalCandidateChunks: contextPack.totalCandidateChunks,
        maxChars: contextPack.maxChars,
        usedChars: contextPack.usedChars,
        truncated: contextPack.truncated,
      },
      fullDocumentRead: fullDocContext.audit,
      chunks: contextPack.chunks.map((row) => toChunkAudit(row)),
      queryEmbedding: {
        model: prepared.embedding.model,
        dimension: prepared.embedding.dimension,
      },
      llm: {
        provider: "vllm_internal",
        baseUrl: this.llmClient.getConfig().baseUrl,
        model: llmResult.model,
        runtimeMode: "full",
        maxTokens: effectiveMaxResponseTokens,
        temperature: clampTemperature(runtimeInput.temperature, this.generationConfig.temperature),
        seed: normalizeSeed(runtimeInput.seed, this.generationConfig.seed),
        finishReason: llmResult.finishReason,
        usage: llmResult.usage,
      },
      timingsMs: {
        embedding: prepared.embedding.elapsedMs,
        retrieval: retrieval.elapsedMs,
        contextAssembly: contextAssemblyMs,
        llm: llmResult.elapsedMs,
        total: Date.now() - startedAt,
      },
    };

    logger.info("RAG_QUERY_DONE", {
      requestId: runtimeInput.requestId || null,
      answerChars: llmResult.answer.length,
      retrievedChunks: retrieval.hits.length,
      selectedChunks: contextPack.chunks.length,
      identitySharedMemoryStatus: identitySharedMemory.status,
      identitySharedMemoryChars: identityContextPack.length,
      fullDocLoaded: fullDocContext.audit.loadedDocs,
      fullDocIncludedChars: fullDocContext.audit.includedChars,
      combinedContextChars: combinedContext.length,
      combinedContextTruncated: combinedContext.length < combinedContextRaw.length,
      combinedContextCap: fullContextCap,
      topK: retrieval.params.topK,
      model: llmResult.model,
      degraded: prepared.degradation.degraded,
    });

    return {
      answer: llmResult.answer,
      metadata,
    };
  }

  async queryStream(input: RagQueryInput): Promise<ReadableStream<Uint8Array>> {
    const contract = buildComposerRagContract({
      question: input.question,
      documentId: input.documentId,
      documentIds: input.documentIds,
      composerBound: input.composerBound,
      composerAttachmentIds: input.composerAttachmentIds,
      preferredResponseLanguageId: input.preferredResponseLanguageId,
      strictDocumentGrounding: input.strictDocumentGrounding,
    });
    const effectiveInput: RagQueryInput = {
      ...input,
      question: contract.question,
      composerBound: contract.composerBound,
      scopeMode: contract.scopeMode,
      documentId: contract.documentId,
      documentIds: contract.documentIds,
      priorityDocumentIds: contract.priorityDocumentIds,
      strictDocumentGrounding: contract.strictDocumentGrounding,
      preferredResponseLanguageId: contract.preferredResponseLanguageId,
    };
    const question = contract.question;
    const requestId = effectiveInput.requestId || null;
    const routingText = normalizeString(effectiveInput.routingHint) || question;
    let semanticQuestion = routingText;
    let runtimeInput = effectiveInput;
    const continuation = await this.resolveClarificationContinuation({
      question: routingText,
      effectiveInput: runtimeInput,
    });
    if (continuation) {
      if ("localReply" in continuation) {
        return this.toPlainTextStream(continuation.localReply.answer);
      }
      runtimeInput = continuation.effectiveInput;
      semanticQuestion = continuation.semanticQuestion;
    }
    const clarification = resolveDocumentClarificationReply(semanticQuestion, {
      composerBound: runtimeInput.composerBound,
      documentId: runtimeInput.documentId,
      documentIds: runtimeInput.documentIds,
    });
    if (clarification) {
      logger.info("RAG_DOCUMENT_REFERENCE_STREAM_CLARIFICATION", {
        requestId,
        reason: clarification.reason,
        textChars: semanticQuestion.length,
      });
      return this.toPlainTextStream(clarification.answer);
    }
    if (this.shouldUseLocalIntentFastPath()) {
      const localIntent = await this.resolveLocalIntentReply(semanticQuestion, runtimeInput.history);
      if (localIntent) {
        logger.info("RAG_LOCAL_INTENT_STREAM_REPLY", {
          requestId,
          reason: localIntent.reason,
          textChars: semanticQuestion.length,
        });
        return this.toPlainTextStream(localIntent.answer);
      }
    }
    const routed = this.resolveProcessingMode(runtimeInput, semanticQuestion);
    this.trackRouterStats(routed.mode, routed.decision, requestId);
    const promptTokensEst = Math.max(1, Math.ceil(semanticQuestion.length / 4));

    logger.info("RAG_COMPLEXITY_ROUTER_DECISION_STREAM", {
      requestId,
      mode: routed.mode,
      score: routed.decision.score,
      hardRule: routed.decision.hardRule,
      reasons: routed.decision.reasons,
      policyOverrides: routed.decision.policyOverrides,
      textChars: routed.decision.textChars,
      textWords: routed.decision.textWords,
      promptTokensEst,
    });

    if (routed.mode === "lite") {
      return this.runLiteStream(runtimeInput, semanticQuestion, requestId);
    }

    const effectiveMaxResponseTokens = this.resolveMaxResponseTokens(runtimeInput, "full", requestId);
    const pipelineVersion = this.resolvePipelineVersion(runtimeInput);

    logger.info("RAG_COMPOSER_CONTRACT_APPLIED", {
      requestId: runtimeInput.requestId || null,
      composerBound: contract.composerBound,
      strictDocumentGrounding: contract.strictDocumentGrounding,
      hasDocumentScope: contract.hasDocumentScope,
      scopeMode: contract.scopeMode,
      scopeSource: contract.scopeSource,
      documentId: contract.documentId ?? null,
      documentIds: contract.documentIds,
      priorityDocumentIds: contract.priorityDocumentIds,
      preferredResponseLanguageId: contract.preferredResponseLanguageId || null,
    });

    logger.info("RAG_QUERY_STREAM_START", {
      requestId,
      pipelineVersion,
      questionChars: semanticQuestion.length,
      topK: runtimeInput.topK,
      sourceType: runtimeInput.sourceType || null,
      documentId: runtimeInput.documentId ?? null,
      documentIds: normalizeDocumentIds(runtimeInput.documentIds),
    });

    if (pipelineVersion === "v2") {
      const streamChunkSize = parsePositiveInt(process.env.RAG_STREAM_V2_CHUNK_SIZE, 240, 48, 2048);
      const showPasses = parseOptionalBoolean(process.env.RAG_STREAM_SHOW_PASSES) ?? true;
      logger.info("RAG_QUERY_STREAM_V2_MODE", {
        requestId: runtimeInput.requestId || null,
        mode: "precision_multicall_internal",
        streamChunkSize,
        showPasses,
      });
      return new ReadableStream<Uint8Array>({
        start: async (controller) => {
          const encoder = new TextEncoder();
          const startedAt = Date.now();
          let emittedAnyDelta = false;
          const enqueueText = (text: string) => {
            if (!text) return;
            emittedAnyDelta = true;
            controller.enqueue(encoder.encode(text));
          };
          const enqueueEvent = (payload: Record<string, unknown>) => {
            const encoded = encodeKnxStreamEvent(payload);
            if (!encoded) return;
            controller.enqueue(encoder.encode(encoded));
          };
          try {
            if (showPasses) {
              enqueueEvent({
                event: "progress",
                stage: "INGEST",
                text: "Recebendo sua solicitacao.",
                requestId: runtimeInput.requestId || null,
                runId: null,
                elapsedMs: 0,
              });
            }

            const history = normalizeHistory(runtimeInput.history, this.generationConfig);
            let v2Result;
            try {
              v2Result = await this.orchestratorV2.query({
                requestId: runtimeInput.requestId || `ragv2s-${Date.now()}`,
                question: semanticQuestion,
                history,
                topK: runtimeInput.topK,
                maxDistance: runtimeInput.maxDistance,
                documentId: runtimeInput.documentId,
                documentIds: runtimeInput.documentIds,
                priorityDocumentIds: runtimeInput.priorityDocumentIds,
                sourceType: runtimeInput.sourceType,
                retrievalEmbeddingModel: runtimeInput.retrievalEmbeddingModel,
                preferredResponseLanguageId: runtimeInput.preferredResponseLanguageId,
                strictDocumentGrounding: runtimeInput.strictDocumentGrounding,
                maxResponseTokens: effectiveMaxResponseTokens,
                temperature: runtimeInput.temperature,
                seed: runtimeInput.seed,
                anmEngineMode: runtimeInput.anmEngineMode,
                anmBaseUrl: runtimeInput.anmBaseUrl,
                anmTimeoutMs: runtimeInput.anmTimeoutMs,
                anmSoftTimeoutMs: runtimeInput.anmSoftTimeoutMs,
                anmFallbackToDirect: runtimeInput.anmFallbackToDirect,
                onProgress: async (event) => {
                  if (!showPasses) return;
                  if (event.progress) {
                    const row = event.progress;
                    enqueueEvent({
                      event: "progress",
                      type: row.type,
                      stage: row.stage,
                      substage: row.substage,
                      text: row.message,
                      requestId: row.request_id,
                      runId: row.run_id,
                      ts: row.ts,
                      elapsedMs: row.elapsed_ms,
                      target: row.target,
                      progressPct: row.progress_pct ?? null,
                      counters: row.counters ?? null,
                      detail: row.detail ?? null,
                      phase: event.phase,
                      sectionIndex: event.sectionIndex ?? null,
                      sectionTotal: event.sectionTotal ?? null,
                      sectionTitle: event.sectionTitle ?? null,
                    });
                    return;
                  }
                  enqueueEvent({
                    event: "progress",
                    stage: event.stage,
                    text: event.message,
                    phase: event.phase,
                    requestId: event.requestId,
                    runId: event.runId,
                    elapsedMs: event.elapsedMs,
                    sectionIndex: event.sectionIndex ?? null,
                    sectionTotal: event.sectionTotal ?? null,
                    sectionTitle: event.sectionTitle ?? null,
                  });
                },
                onFinalDelta: async (delta) => {
                  const text = `${delta || ""}`;
                  if (!text) return;
                  for (let cursor = 0; cursor < text.length; cursor += streamChunkSize) {
                    enqueueText(text.slice(cursor, Math.min(text.length, cursor + streamChunkSize)));
                    await new Promise<void>((resolve) => setTimeout(resolve, 0));
                  }
                },
              });
            } catch (error) {
              const groundingFallback = resolveGroundingFallbackReply(error, {
                documentId: runtimeInput.documentId,
                documentIds: runtimeInput.documentIds,
              });
              if (groundingFallback) {
                logger.warn("RAG_DOCUMENT_GROUNDING_STREAM_FALLBACK", {
                  requestId: runtimeInput.requestId || null,
                  reason: groundingFallback.reason,
                  errorCode: error instanceof RagPipelineError ? error.code : null,
                });
                enqueueText(groundingFallback.answer);
                controller.close();
                return;
              }
              throw error;
            }
            logger.info("RAG_QUERY_STREAM_V2_READY", {
              requestId: runtimeInput.requestId || null,
              answerChars: v2Result.answer.length,
              retrievedChunks: v2Result.metadata.retrieval.returnedChunks,
              selectedChunks: v2Result.metadata.contextPack.selectedChunks,
              writerMode: v2Result.metadata.v2.writerMode,
              writerSections: v2Result.metadata.v2.writerSections,
              writerLlmCalls: v2Result.metadata.v2.writerLlmCalls,
              writerReinforcementCalls: v2Result.metadata.v2.writerReinforcementCalls,
              multicallLockEnabled: v2Result.metadata.v2.multicallLockEnabled,
              multicallMinWriterCalls: v2Result.metadata.v2.multicallMinWriterCalls,
              llmElapsedMs: v2Result.metadata.timingsMs.llm,
              totalMs: v2Result.metadata.timingsMs.total,
            });

            if (showPasses) {
              const elapsedMs = Date.now() - startedAt;
              enqueueEvent({
                event: "progress",
                stage: "FINALIZE",
                substage: "stream_done",
                text: `Concluido em ${elapsedMs} ms.`,
                elapsedMs,
                requestId: runtimeInput.requestId || null,
                runId: v2Result.metadata.v2.runId,
              });
            }
            if (!emittedAnyDelta) {
              const answer = `${v2Result.answer || ""}`;
              for (let cursor = 0; cursor < answer.length; cursor += streamChunkSize) {
                enqueueText(answer.slice(cursor, Math.min(answer.length, cursor + streamChunkSize)));
                await new Promise<void>((resolve) => setTimeout(resolve, 0));
              }
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });
    }

    const prepared = await this.prepareQuery(runtimeInput, semanticQuestion);
    const retrieval = prepared.retrieval;
    const appliedRetrievalModelFilter = prepared.appliedRetrievalModelFilter;
    const latencyGuardMinChunks = parsePositiveInt(process.env.RAG_LATENCY_GUARD_MIN_CHUNKS, 3, 0, 50);
    const aggressiveRequested = this.latencyPreset === "aggressive";
    const weakEvidence = prepared.degradation.degraded || retrieval.hits.length < latencyGuardMinChunks;
    const effectiveAggressive = aggressiveRequested && !weakEvidence;
    const queryComplexity = inferQueryComplexity(semanticQuestion);
    const requestedMaxTokens = effectiveMaxResponseTokens;
    const runtimeProfile = buildStreamRuntimeProfile({
      complexity: queryComplexity,
      requestedMaxTokens,
      effectiveAggressive,
      weakEvidence,
    });

    const contextPack = assembleContextPack({
      hits: retrieval.hits,
      maxChars: this.contextConfig.maxChars,
      maxChunks: this.contextConfig.maxChunks,
    });
    // Por seguranca semantica, so pula leitura integral com opt-in explicito.
    const skipFullDocByPreset =
      effectiveAggressive && queryComplexity === "simple" && parseOptionalBoolean(process.env.RAG_STREAM_SKIP_FULLDOC) === true;
    const fullDocContext = skipFullDocByPreset
      ? {
          text: "",
          audit: {
            enabled: false,
            attemptedDocs: 0,
            loadedDocs: 0,
            contextDocs: 0,
            failedDocs: 0,
            fullReadChars: 0,
            includedChars: 0,
            truncatedDocs: 0,
            sources: [],
          },
        }
      : prepared.fullDocumentSeedIds.length > 0
        ? await this.fullDocumentService.buildContextFromDocumentIds(prepared.fullDocumentSeedIds)
        : await this.fullDocumentService.buildContextFromHits(retrieval.hits);
    const identitySharedMemory = await resolveIdentityRuntimeSharedContext();
    const identityContextPack = identitySharedMemory.promptBlock || "";
    const combinedContextRaw = [identityContextPack, contextPack.text, fullDocContext.text].filter(Boolean).join("\n\n");
    const defaultStreamContextCap =
      fullDocContext.audit.loadedDocs > 0 ? Math.max(15_000, runtimeProfile.contextCap) : runtimeProfile.contextCap;
    const streamContextCap = parsePositiveInt(
      process.env.RAG_STREAM_CONTEXT_MAX_CHARS,
      defaultStreamContextCap,
      2_000,
      60_000,
    );
    const combinedContext =
      combinedContextRaw.length > streamContextCap
        ? combinedContextRaw.slice(0, streamContextCap)
        : combinedContextRaw;
    const baseHistory = normalizeHistory(runtimeInput.history, this.generationConfig);
    const streamHistoryMaxMessages = parsePositiveInt(
      process.env.RAG_STREAM_HISTORY_MAX_MESSAGES,
      runtimeProfile.historyMaxMessages,
      0,
      50,
    );
    const streamHistoryMaxChars = parsePositiveInt(
      process.env.RAG_STREAM_HISTORY_MAX_CHARS,
      runtimeProfile.historyMaxChars,
      0,
      40_000,
    );
    const history = normalizeHistory(baseHistory, {
      ...this.generationConfig,
      historyMaxMessages: streamHistoryMaxMessages,
      historyMaxChars: streamHistoryMaxChars,
    });

    logger.info("RAG_QUERY_STREAM_READY", {
      requestId: runtimeInput.requestId || null,
      retrievedChunks: retrieval.hits.length,
      selectedChunks: contextPack.chunks.length,
      contextChars: contextPack.usedChars,
      identitySharedMemoryStatus: identitySharedMemory.status,
      identitySharedMemoryChars: identityContextPack.length,
      fullDocLoaded: fullDocContext.audit.loadedDocs,
      fullDocIncludedChars: fullDocContext.audit.includedChars,
      latencyPreset: this.latencyPreset,
      queryComplexity,
      effectiveAggressive,
      weakEvidence,
      latencyGuardMinChunks,
      streamHistoryItems: history.length,
      skipFullDocByPreset,
      streamContextCap,
      combinedContextChars: combinedContext.length,
      combinedContextTruncated: combinedContext.length < combinedContextRaw.length,
      embeddingModelFilter: appliedRetrievalModelFilter || null,
      degraded: prepared.degradation.degraded,
    });

    const streamMaxTokensOverride = parsePositiveInt(
      process.env.RAG_STREAM_MAX_TOKENS,
      runtimeProfile.maxTokensCap,
      64,
      65_536,
    );
    const streamMaxTokensCap = Math.max(runtimeProfile.maxTokensCap, streamMaxTokensOverride);
    const effectiveMaxTokens = Math.max(64, Math.min(requestedMaxTokens, streamMaxTokensCap));
    const streamPassCount = resolveStreamMulticallPassCount({
      complexity: queryComplexity,
      pipelineVersion,
      weakEvidence,
    });
    logger.info("RAG_QUERY_STREAM_MULTICALL_PLAN", {
      requestId: runtimeInput.requestId || null,
      pipelineVersion,
      passCount: streamPassCount,
      complexity: queryComplexity,
      weakEvidence,
      maxTokensPerPass: effectiveMaxTokens,
    });

    if (streamPassCount <= 1) {
      return this.llmClient.streamWithContext({
        question: semanticQuestion,
        contextPack: combinedContext,
        history,
        maxTokens: effectiveMaxTokens,
        temperature: clampTemperature(runtimeInput.temperature, this.generationConfig.temperature),
        seed: normalizeSeed(runtimeInput.seed, this.generationConfig.seed),
        ...this.resolveAnmRoutingInput(runtimeInput),
      });
    }

    return new ReadableStream<Uint8Array>({
      start: async (controller) => {
        let rollingHistory = [...history];
        const encoder = new TextEncoder();
        try {
          for (let passIndex = 1; passIndex <= streamPassCount; passIndex += 1) {
            const passQuestion = buildStreamMulticallQuestion(semanticQuestion, passIndex, streamPassCount);
            logger.info("RAG_QUERY_STREAM_MULTICALL_PASS_START", {
              requestId: runtimeInput.requestId || null,
              passIndex,
              streamPassCount,
            });

            const passStream = await this.llmClient.streamWithContext({
              question: passQuestion,
              contextPack: combinedContext,
              history: rollingHistory,
              maxTokens: effectiveMaxTokens,
              temperature: clampTemperature(runtimeInput.temperature, this.generationConfig.temperature),
              seed: normalizeSeed(runtimeInput.seed, this.generationConfig.seed),
              followupMode: passIndex < streamPassCount ? "omit" : "required",
              ...this.resolveAnmRoutingInput(runtimeInput),
            });

            const reader = passStream.getReader();
            const decoder = new TextDecoder();
            let passText = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (!value || !value.length) continue;
              passText += decoder.decode(value, { stream: true });
              controller.enqueue(value);
            }
            const tail = decoder.decode();
            if (tail) {
              passText += tail;
              controller.enqueue(encoder.encode(tail));
            }
            reader.releaseLock();

            const normalizedPassText = `${passText || ""}`.trim();
            logger.info("RAG_QUERY_STREAM_MULTICALL_PASS_DONE", {
              requestId: runtimeInput.requestId || null,
              passIndex,
              streamPassCount,
              passChars: normalizedPassText.length,
            });

            if (normalizedPassText) {
              rollingHistory = normalizeHistory(
                [
                  ...rollingHistory,
                  { role: "user", content: `[continuidade passo ${passIndex}/${streamPassCount}]` },
                  { role: "assistant", content: normalizedPassText },
                ],
                {
                  ...this.generationConfig,
                  historyMaxMessages: streamHistoryMaxMessages,
                  historyMaxChars: streamHistoryMaxChars,
                },
              );
            }

            if (passIndex < streamPassCount) {
              controller.enqueue(encoder.encode("\n\n"));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }
}

export function createRagQueryService(rawEnv = process.env) {
  return new RagQueryService(
    createQueryEmbeddingClient(rawEnv),
    createRagRetrievalService(),
    createVllmInternalClient(rawEnv),
    createDocumentFullTextService(rawEnv),
    createVectorDatabaseClient(rawEnv),
    createRagInternetSearchService(rawEnv),
    {
      generationConfig: loadRagGenerationConfig(rawEnv),
      resilienceConfig: loadRagResilienceConfig(rawEnv),
      contextConfig: loadRagContextConfig(rawEnv),
      pipelineFlags: loadRagPipelineFlags(rawEnv),
      latencyPreset: parseLatencyPreset(rawEnv.RAG_LATENCY_PRESET),
    },
  );
}

export function getRagRouterStatsSnapshot() {
  return toRouterStatsSnapshot(GLOBAL_ROUTER_STATS);
}

export function resetRagRouterStats() {
  GLOBAL_ROUTER_STATS.total = 0;
  GLOBAL_ROUTER_STATS.lite = 0;
  GLOBAL_ROUTER_STATS.full = 0;
  GLOBAL_ROUTER_STATS.fullNearLite = 0;
  return getRagRouterStatsSnapshot();
}



