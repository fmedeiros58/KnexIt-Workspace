import { resolveVectorSearchParams, type VectorSearchParams } from "../database/vector-search-params";
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
import { createVllmInternalClient, type RagChatHistoryItem, type VllmInternalClient } from "./vllm-client";
import { RagOrchestratorV2 } from "./v2/orchestrator_v2";

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

export class RagQueryService {
  private readonly generationConfig: RagGenerationConfig;
  private readonly contextConfig: { maxChars: number; maxChunks: number };
  private readonly resilienceConfig: RagResilienceConfig;
  private readonly pipelineFlags: RagPipelineFlags;
  private readonly latencyPreset: RagLatencyPreset;
  private readonly orchestratorV2: RagOrchestratorV2;
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
    options?: RagQueryServiceOptions,
  ) {
    this.generationConfig = options?.generationConfig ?? loadRagGenerationConfig();
    this.contextConfig = options?.contextConfig ?? loadRagContextConfig();
    this.resilienceConfig = options?.resilienceConfig ?? loadRagResilienceConfig();
    this.pipelineFlags = options?.pipelineFlags ?? loadRagPipelineFlags();
    this.latencyPreset = options?.latencyPreset ?? parseLatencyPreset(process.env.RAG_LATENCY_PRESET);
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

  private resolveLiteTokens(requestedMaxTokens: number) {
    const liteCap = parsePositiveInt(process.env.RAG_LITE_MAX_TOKENS, 192, 64, 2048);
    return Math.max(64, Math.min(requestedMaxTokens, liteCap));
  }

  private resolveLiteTemperature(fallback: number) {
    const raw = Number(process.env.RAG_LITE_TEMPERATURE);
    if (Number.isFinite(raw)) return Math.max(0, Math.min(2, raw));
    return fallback;
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
    const history = this.resolveLiteHistory(input.history);
    const maxTokens = this.resolveLiteTokens(clampMaxTokens(input.maxResponseTokens, this.generationConfig.maxTokens));
    const temperature = this.resolveLiteTemperature(clampTemperature(input.temperature, this.generationConfig.temperature));
    const llmResult = await this.llmClient.completeWithContext({
      question: liteQuestion,
      contextPack: "",
      history,
      maxTokens,
      temperature,
      seed: normalizeSeed(input.seed, this.generationConfig.seed),
      runtimeMode: "lite",
      responseLanguageId: input.preferredResponseLanguageId,
    });
    const totalMs = Date.now() - startedAt;
    logger.info("RAG_LITE_QUERY_DONE", {
      requestId,
      answerChars: llmResult.answer.length,
      maxTokens,
      historyItems: history.length,
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
    const history = this.resolveLiteHistory(input.history);
    const maxTokens = this.resolveLiteTokens(clampMaxTokens(input.maxResponseTokens, this.generationConfig.maxTokens));
    const temperature = this.resolveLiteTemperature(clampTemperature(input.temperature, this.generationConfig.temperature));
    logger.info("RAG_LITE_STREAM_READY", {
      requestId,
      questionChars: liteQuestion.length,
      maxTokens,
      historyItems: history.length,
    });
    return this.llmClient.streamWithContext({
      question: liteQuestion,
      contextPack: "",
      history,
      maxTokens,
      temperature,
      seed: normalizeSeed(input.seed, this.generationConfig.seed),
      runtimeMode: "lite",
      responseLanguageId: input.preferredResponseLanguageId,
    });
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
    const routed = this.resolveProcessingMode(effectiveInput, routingText);
    this.trackRouterStats(routed.mode, routed.decision, requestId);
    const promptTokensEst = Math.max(1, Math.ceil(routingText.length / 4));
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
      return this.runLiteQuery(effectiveInput, question, requestId);
    }

    const pipelineVersion = this.resolvePipelineVersion(effectiveInput);
    if (pipelineVersion === "v2") {
      const history = normalizeHistory(effectiveInput.history, this.generationConfig);
      const v2Result = await this.orchestratorV2.query({
        requestId: effectiveInput.requestId || `ragv2-${Date.now()}`,
        question,
        history,
        topK: effectiveInput.topK,
        maxDistance: effectiveInput.maxDistance,
        documentId: effectiveInput.documentId,
        documentIds: effectiveInput.documentIds,
        priorityDocumentIds: effectiveInput.priorityDocumentIds,
        sourceType: effectiveInput.sourceType,
        retrievalEmbeddingModel: effectiveInput.retrievalEmbeddingModel,
        preferredResponseLanguageId: effectiveInput.preferredResponseLanguageId,
        strictDocumentGrounding: effectiveInput.strictDocumentGrounding,
        maxResponseTokens: effectiveInput.maxResponseTokens,
        temperature: effectiveInput.temperature,
        seed: effectiveInput.seed,
      });
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
      requestId: effectiveInput.requestId || null,
      questionChars: question.length,
      topK: effectiveInput.topK,
      sourceType: effectiveInput.sourceType || null,
      documentId: effectiveInput.documentId ?? null,
      documentIds: normalizeDocumentIds(effectiveInput.documentIds),
    });

    const prepared = await this.prepareQuery(effectiveInput, question);
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
    const combinedContextRaw = [contextPack.text, fullDocContext.text].filter(Boolean).join("\n\n");
    const fullContextCap = parsePositiveInt(
      process.env.RAG_FULL_CONTEXT_MAX_CHARS,
      Math.max(this.contextConfig.maxChars, 15_000),
      2_000,
      80_000,
    );
    const combinedContext =
      combinedContextRaw.length > fullContextCap ? combinedContextRaw.slice(0, fullContextCap) : combinedContextRaw;
    const contextAssemblyMs = Date.now() - contextAssemblyStartedAt;

    const history = normalizeHistory(effectiveInput.history, this.generationConfig);
    const llmResult = await this.llmClient.completeWithContext({
      question,
      contextPack: combinedContext,
      history,
      maxTokens: clampMaxTokens(effectiveInput.maxResponseTokens, this.generationConfig.maxTokens),
      temperature: clampTemperature(effectiveInput.temperature, this.generationConfig.temperature),
      seed: normalizeSeed(effectiveInput.seed, this.generationConfig.seed),
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
          documentId: effectiveInput.documentId ?? null,
          documentIds: normalizeDocumentIds(effectiveInput.documentIds),
          sourceType: normalizeString(effectiveInput.sourceType) || null,
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
        maxTokens: clampMaxTokens(effectiveInput.maxResponseTokens, this.generationConfig.maxTokens),
        temperature: clampTemperature(effectiveInput.temperature, this.generationConfig.temperature),
        seed: normalizeSeed(effectiveInput.seed, this.generationConfig.seed),
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
      requestId: effectiveInput.requestId || null,
      answerChars: llmResult.answer.length,
      retrievedChunks: retrieval.hits.length,
      selectedChunks: contextPack.chunks.length,
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
    const routed = this.resolveProcessingMode(effectiveInput, routingText);
    this.trackRouterStats(routed.mode, routed.decision, requestId);
    const promptTokensEst = Math.max(1, Math.ceil(routingText.length / 4));

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
      return this.runLiteStream(effectiveInput, question, requestId);
    }

    const pipelineVersion = this.resolvePipelineVersion(effectiveInput);

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

    logger.info("RAG_QUERY_STREAM_START", {
      requestId,
      pipelineVersion,
      questionChars: question.length,
      topK: effectiveInput.topK,
      sourceType: effectiveInput.sourceType || null,
      documentId: effectiveInput.documentId ?? null,
      documentIds: normalizeDocumentIds(effectiveInput.documentIds),
    });

    if (pipelineVersion === "v2") {
      const streamChunkSize = parsePositiveInt(process.env.RAG_STREAM_V2_CHUNK_SIZE, 240, 48, 2048);
      const showPasses = parseOptionalBoolean(process.env.RAG_STREAM_SHOW_PASSES) ?? true;
      logger.info("RAG_QUERY_STREAM_V2_MODE", {
        requestId: effectiveInput.requestId || null,
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
                requestId: effectiveInput.requestId || null,
                runId: null,
                elapsedMs: 0,
              });
            }

            const history = normalizeHistory(effectiveInput.history, this.generationConfig);
            const v2Result = await this.orchestratorV2.query({
              requestId: effectiveInput.requestId || `ragv2s-${Date.now()}`,
              question,
              history,
              topK: effectiveInput.topK,
              maxDistance: effectiveInput.maxDistance,
              documentId: effectiveInput.documentId,
              documentIds: effectiveInput.documentIds,
              priorityDocumentIds: effectiveInput.priorityDocumentIds,
              sourceType: effectiveInput.sourceType,
              retrievalEmbeddingModel: effectiveInput.retrievalEmbeddingModel,
              preferredResponseLanguageId: effectiveInput.preferredResponseLanguageId,
              strictDocumentGrounding: effectiveInput.strictDocumentGrounding,
              maxResponseTokens: effectiveInput.maxResponseTokens,
              temperature: effectiveInput.temperature,
              seed: effectiveInput.seed,
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
            logger.info("RAG_QUERY_STREAM_V2_READY", {
              requestId: effectiveInput.requestId || null,
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
                requestId: effectiveInput.requestId || null,
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

    const prepared = await this.prepareQuery(effectiveInput, question);
    const retrieval = prepared.retrieval;
    const appliedRetrievalModelFilter = prepared.appliedRetrievalModelFilter;
    const latencyGuardMinChunks = parsePositiveInt(process.env.RAG_LATENCY_GUARD_MIN_CHUNKS, 3, 0, 50);
    const aggressiveRequested = this.latencyPreset === "aggressive";
    const weakEvidence = prepared.degradation.degraded || retrieval.hits.length < latencyGuardMinChunks;
    const effectiveAggressive = aggressiveRequested && !weakEvidence;
    const queryComplexity = inferQueryComplexity(question);
    const requestedMaxTokens = clampMaxTokens(effectiveInput.maxResponseTokens, this.generationConfig.maxTokens);
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
    const combinedContextRaw = [contextPack.text, fullDocContext.text].filter(Boolean).join("\n\n");
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
    const baseHistory = normalizeHistory(effectiveInput.history, this.generationConfig);
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
      requestId: effectiveInput.requestId || null,
      retrievedChunks: retrieval.hits.length,
      selectedChunks: contextPack.chunks.length,
      contextChars: contextPack.usedChars,
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
      requestId: effectiveInput.requestId || null,
      pipelineVersion,
      passCount: streamPassCount,
      complexity: queryComplexity,
      weakEvidence,
      maxTokensPerPass: effectiveMaxTokens,
    });

    if (streamPassCount <= 1) {
      return this.llmClient.streamWithContext({
        question,
        contextPack: combinedContext,
        history,
        maxTokens: effectiveMaxTokens,
        temperature: clampTemperature(effectiveInput.temperature, this.generationConfig.temperature),
        seed: normalizeSeed(effectiveInput.seed, this.generationConfig.seed),
      });
    }

    return new ReadableStream<Uint8Array>({
      start: async (controller) => {
        let rollingHistory = [...history];
        const encoder = new TextEncoder();
        try {
          for (let passIndex = 1; passIndex <= streamPassCount; passIndex += 1) {
            const passQuestion = buildStreamMulticallQuestion(question, passIndex, streamPassCount);
            logger.info("RAG_QUERY_STREAM_MULTICALL_PASS_START", {
              requestId: effectiveInput.requestId || null,
              passIndex,
              streamPassCount,
            });

            const passStream = await this.llmClient.streamWithContext({
              question: passQuestion,
              contextPack: combinedContext,
              history: rollingHistory,
              maxTokens: effectiveMaxTokens,
              temperature: clampTemperature(effectiveInput.temperature, this.generationConfig.temperature),
              seed: normalizeSeed(effectiveInput.seed, this.generationConfig.seed),
              followupMode: passIndex < streamPassCount ? "omit" : "required",
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
              requestId: effectiveInput.requestId || null,
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

