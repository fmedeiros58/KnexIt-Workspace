import { logger } from "../utils/logger";
import { assembleContextPack, type ContextPackChunk } from "./context-pack";
import { createQueryEmbeddingClient, type QueryEmbeddingClient } from "./embedding-client";
import { loadRagContextConfig, loadRagGenerationConfig, type RagGenerationConfig } from "./rag-config";
import { RagPipelineError } from "./rag-errors";
import { createRagRetrievalService, type RagRetrievalService } from "./retrieval-service";
import { createVllmInternalClient, type RagChatHistoryItem, type VllmInternalClient } from "./vllm-client";

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
  topK?: number;
  maxDistance?: number | null;
  documentId?: number;
  sourceType?: string;
  retrievalEmbeddingModel?: string;
  maxResponseTokens?: number;
  temperature?: number;
  seed?: number | null;
};

export type RagQueryResult = {
  answer: string;
  metadata: {
    retrieval: {
      topK: number;
      maxDistance: number | null;
      strategy: "cosine";
      filters: {
        documentId: number | null;
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
  };
};

type RagQueryServiceOptions = {
  embeddingClient?: QueryEmbeddingClient;
  retrievalService?: RagRetrievalService;
  llmClient?: VllmInternalClient;
  generationConfig?: RagGenerationConfig;
  contextConfig?: {
    maxChars: number;
    maxChunks: number;
  };
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
  return Math.min(8_192, Math.max(32, rounded));
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

export class RagQueryService {
  private readonly generationConfig: RagGenerationConfig;
  private readonly contextConfig: { maxChars: number; maxChunks: number };

  constructor(
    private readonly embeddingClient: QueryEmbeddingClient = createQueryEmbeddingClient(),
    private readonly retrievalService: RagRetrievalService = createRagRetrievalService(),
    private readonly llmClient: VllmInternalClient = createVllmInternalClient(),
    options?: RagQueryServiceOptions,
  ) {
    this.generationConfig = options?.generationConfig ?? loadRagGenerationConfig();
    this.contextConfig = options?.contextConfig ?? loadRagContextConfig();
  }

  async query(input: RagQueryInput): Promise<RagQueryResult> {
    const question = normalizeString(input.question);
    if (!question) {
      throw new RagPipelineError(400, "RAG_QUESTION_REQUIRED", "Campo question e obrigatorio.");
    }

    const startedAt = Date.now();
    logger.info("RAG_QUERY_START", {
      requestId: input.requestId || null,
      questionChars: question.length,
      topK: input.topK,
      sourceType: input.sourceType || null,
      documentId: input.documentId ?? null,
    });

    const embedding = await this.embeddingClient.embedQuery(question);
    const explicitRetrievalModelFilter = normalizeString(input.retrievalEmbeddingModel);
    let appliedRetrievalModelFilter = explicitRetrievalModelFilter || embedding.model;
    let retrieval = await this.retrievalService.search({
      queryVector: embedding.vector,
      topK: input.topK,
      maxDistance: input.maxDistance,
      documentId: input.documentId,
      sourceType: normalizeString(input.sourceType) || undefined,
      embeddingModel: appliedRetrievalModelFilter || undefined,
    });
    if (!retrieval.hits.length && !explicitRetrievalModelFilter) {
      logger.warn("RAG_QUERY_RETRIEVAL_MODEL_FALLBACK", {
        requestId: input.requestId || null,
        queryEmbeddingModel: embedding.model,
        reason: "zero_hits_with_model_filter",
      });
      retrieval = await this.retrievalService.search({
        queryVector: embedding.vector,
        topK: input.topK,
        maxDistance: input.maxDistance,
        documentId: input.documentId,
        sourceType: normalizeString(input.sourceType) || undefined,
      });
      appliedRetrievalModelFilter = "";
    }

    const contextAssemblyStartedAt = Date.now();
    const contextPack = assembleContextPack({
      hits: retrieval.hits,
      maxChars: this.contextConfig.maxChars,
      maxChunks: this.contextConfig.maxChunks,
    });
    const contextAssemblyMs = Date.now() - contextAssemblyStartedAt;

    const history = normalizeHistory(input.history, this.generationConfig);
    const llmResult = await this.llmClient.completeWithContext({
      question,
      contextPack: contextPack.text,
      history,
      maxTokens: clampMaxTokens(input.maxResponseTokens, this.generationConfig.maxTokens),
      temperature: clampTemperature(input.temperature, this.generationConfig.temperature),
      seed: normalizeSeed(input.seed, this.generationConfig.seed),
    });

    const metadata: RagQueryResult["metadata"] = {
      retrieval: {
        topK: retrieval.params.topK,
        maxDistance: retrieval.params.maxDistance,
        strategy: retrieval.params.strategy,
        filters: {
          documentId: input.documentId ?? null,
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
      chunks: contextPack.chunks.map((row) => toChunkAudit(row)),
      queryEmbedding: {
        model: embedding.model,
        dimension: embedding.dimension,
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
        embedding: embedding.elapsedMs,
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
      topK: retrieval.params.topK,
      model: llmResult.model,
    });

    return {
      answer: llmResult.answer,
      metadata,
    };
  }
}

export function createRagQueryService(rawEnv = process.env) {
  return new RagQueryService(createQueryEmbeddingClient(rawEnv), createRagRetrievalService(), createVllmInternalClient(rawEnv), {
    generationConfig: loadRagGenerationConfig(rawEnv),
    contextConfig: loadRagContextConfig(rawEnv),
  });
}
