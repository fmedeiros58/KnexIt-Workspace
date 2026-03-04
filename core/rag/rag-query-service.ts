import { resolveVectorSearchParams, type VectorSearchParams } from "../database/vector-search-params";
import { logger } from "../utils/logger";
import { assembleContextPack, type ContextPackChunk } from "./context-pack";
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
  history?: RagChatHistoryItem[];
  requestId?: string;
  pipelineVersion?: "v1" | "v2";
  topK?: number;
  maxDistance?: number | null;
  documentId?: number;
  documentIds?: number[];
  sourceType?: string;
  retrievalEmbeddingModel?: string;
  maxResponseTokens?: number;
  temperature?: number;
  seed?: number | null;
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
  private readonly orchestratorV2: RagOrchestratorV2;

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
    if (input.pipelineVersion === "v2") return "v2";
    if (input.pipelineVersion === "v1") return "v1";
    return this.pipelineFlags.pipelineVersion;
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

  async query(input: RagQueryInput): Promise<RagQueryResult> {
    const question = normalizeString(input.question);
    if (!question) {
      throw new RagPipelineError(400, "RAG_QUESTION_REQUIRED", "Campo question e obrigatorio.");
    }
    const pipelineVersion = this.resolvePipelineVersion(input);
    if (pipelineVersion === "v2") {
      const history = normalizeHistory(input.history, this.generationConfig);
      const v2Result = await this.orchestratorV2.query({
        requestId: input.requestId || `ragv2-${Date.now()}`,
        question,
        history,
        topK: input.topK,
        maxDistance: input.maxDistance,
        documentId: input.documentId,
        documentIds: input.documentIds,
        sourceType: input.sourceType,
        retrievalEmbeddingModel: input.retrievalEmbeddingModel,
        maxResponseTokens: input.maxResponseTokens,
        temperature: input.temperature,
        seed: input.seed,
      });
      return {
        answer: v2Result.answer,
        metadata: {
          ...v2Result.metadata,
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
      requestId: input.requestId || null,
      questionChars: question.length,
      topK: input.topK,
      sourceType: input.sourceType || null,
      documentId: input.documentId ?? null,
      documentIds: normalizeDocumentIds(input.documentIds),
    });

    const prepared = await this.prepareQuery(input, question);
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
    const combinedContext = [contextPack.text, fullDocContext.text].filter(Boolean).join("\n\n");
    const contextAssemblyMs = Date.now() - contextAssemblyStartedAt;

    const history = normalizeHistory(input.history, this.generationConfig);
    const llmResult = await this.llmClient.completeWithContext({
      question,
      contextPack: combinedContext,
      history,
      maxTokens: clampMaxTokens(input.maxResponseTokens, this.generationConfig.maxTokens),
      temperature: clampTemperature(input.temperature, this.generationConfig.temperature),
      seed: normalizeSeed(input.seed, this.generationConfig.seed),
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
          documentId: input.documentId ?? null,
          documentIds: normalizeDocumentIds(input.documentIds),
          sourceType: normalizeString(input.sourceType) || null,
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
        maxTokens: clampMaxTokens(input.maxResponseTokens, this.generationConfig.maxTokens),
        temperature: clampTemperature(input.temperature, this.generationConfig.temperature),
        seed: normalizeSeed(input.seed, this.generationConfig.seed),
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
      requestId: input.requestId || null,
      answerChars: llmResult.answer.length,
      retrievedChunks: retrieval.hits.length,
      selectedChunks: contextPack.chunks.length,
      fullDocLoaded: fullDocContext.audit.loadedDocs,
      fullDocIncludedChars: fullDocContext.audit.includedChars,
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
    const question = normalizeString(input.question);
    if (!question) {
      throw new RagPipelineError(400, "RAG_QUESTION_REQUIRED", "Campo question e obrigatorio.");
    }
    const pipelineVersion = this.resolvePipelineVersion(input);
    if (pipelineVersion === "v2") {
      const result = await this.query({ ...input, question, pipelineVersion: "v2" });
      return this.toPlainTextStream(result.answer);
    }

    logger.info("RAG_QUERY_STREAM_START", {
      requestId: input.requestId || null,
      questionChars: question.length,
      topK: input.topK,
      sourceType: input.sourceType || null,
      documentId: input.documentId ?? null,
      documentIds: normalizeDocumentIds(input.documentIds),
    });

    const prepared = await this.prepareQuery(input, question);
    const retrieval = prepared.retrieval;
    const appliedRetrievalModelFilter = prepared.appliedRetrievalModelFilter;

    const contextPack = assembleContextPack({
      hits: retrieval.hits,
      maxChars: this.contextConfig.maxChars,
      maxChunks: this.contextConfig.maxChunks,
    });
    const fullDocContext =
      prepared.fullDocumentSeedIds.length > 0
        ? await this.fullDocumentService.buildContextFromDocumentIds(prepared.fullDocumentSeedIds)
        : await this.fullDocumentService.buildContextFromHits(retrieval.hits);
    const combinedContext = [contextPack.text, fullDocContext.text].filter(Boolean).join("\n\n");
    const history = normalizeHistory(input.history, this.generationConfig);

    logger.info("RAG_QUERY_STREAM_READY", {
      requestId: input.requestId || null,
      retrievedChunks: retrieval.hits.length,
      selectedChunks: contextPack.chunks.length,
      contextChars: contextPack.usedChars,
      fullDocLoaded: fullDocContext.audit.loadedDocs,
      fullDocIncludedChars: fullDocContext.audit.includedChars,
      embeddingModelFilter: appliedRetrievalModelFilter || null,
      degraded: prepared.degradation.degraded,
    });

    return this.llmClient.streamWithContext({
      question,
      contextPack: combinedContext,
      history,
      maxTokens: clampMaxTokens(input.maxResponseTokens, this.generationConfig.maxTokens),
      temperature: clampTemperature(input.temperature, this.generationConfig.temperature),
      seed: normalizeSeed(input.seed, this.generationConfig.seed),
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
    },
  );
}
