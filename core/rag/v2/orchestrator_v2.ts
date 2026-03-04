import { createVectorRetrievalRepository, type VectorRetrievalRepository } from "@/core/database/vector-retrieval-repository";
import { createQueryEmbeddingClient, type QueryEmbeddingClient } from "@/core/rag/embedding-client";
import {
  loadRagContextConfig,
  loadRagGenerationConfig,
  loadRagPipelineFlags,
  loadRagResilienceConfig,
  type RagContextConfig,
  type RagGenerationConfig,
  type RagPipelineFlags,
  type RagResilienceConfig,
} from "@/core/rag/rag-config";
import { RagPipelineError } from "@/core/rag/rag-errors";
import { createVllmInternalClient, type RagChatHistoryItem, type VllmInternalClient } from "@/core/rag/vllm-client";
import { CitationAlignerV2 } from "@/core/rag/v2/citations/aligner_v2";
import { ContextPackagerV2 } from "@/core/rag/v2/context/packager_v2";
import { emitTrace, hashText, startTrace, timedStage } from "@/core/rag/v2/observability/logger_v2";
import { RunAuditRepositoryV2 } from "@/core/rag/v2/observability/run_audit_repository_v2";
import { HybridRetrieverV2 } from "@/core/rag/v2/retrieval/hybrid_v2";
import { RerankerV2 } from "@/core/rag/v2/rerank/reranker_v2";
import { WriterPipelineV2 } from "@/core/rag/v2/writer/pipeline_v2";

export type OrchestratorV2Input = {
  requestId: string;
  question: string;
  history: RagChatHistoryItem[];
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

export type OrchestratorV2Result = {
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
      strategy: "hybrid_v2";
      filters: {
        documentId: number | null;
        documentIds: number[];
        sourceType: string | null;
        embeddingModel: string | null;
      };
      returnedChunks: number;
      vectorCount: number;
      lexicalCount: number;
      rerankApplied: boolean;
    };
    contextPack: {
      selectedChunks: number;
      omittedChunks: number;
      maxChars: number;
      usedChars: number;
      truncated: boolean;
      budget: {
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
      sources: Array<Record<string, unknown>>;
    };
    citations: {
      enabled: boolean;
      count: number;
      uncoveredClaims: number;
    };
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
        v2: {
          runId: string;
          pipelineVersion: "v2";
          queryHash: string;
          traceStages: Array<{ stage: string; elapsedMs: number }>;
          writerMode: boolean;
          writerSections: number;
          writerLlmCalls: number;
        };
      };
};

function normalizeText(value: string) {
  return `${value || ""}`.trim();
}

function normalizeSeed(value: number | null | undefined, fallback: number | null) {
  if (value === null) return null;
  if (!Number.isFinite(value as number)) return fallback;
  return Math.trunc(value as number);
}

function clampMaxTokens(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value as number)) return fallback;
  const rounded = Math.round(value as number);
  return Math.min(65_536, Math.max(64, rounded));
}

function clampTemperature(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value as number)) return fallback;
  return Math.max(0, Math.min(2, Number(value)));
}

function normalizeDocIds(values: unknown) {
  if (!Array.isArray(values)) return [];
  const seen = new Set<number>();
  const result: number[] = [];
  for (const raw of values) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) continue;
    const id = Math.trunc(parsed);
    if (id <= 0 || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= 64) break;
  }
  return result;
}

function shouldUseWriterMode(question: string, maxTokens: number, enabled: boolean) {
  if (!enabled) return false;
  const normalized = normalizeText(question)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (!normalized) return false;
  if (/\b(resuma|resumo|curto|curta|breve|uma frase|1 frase)\b/.test(normalized)) return false;
  if (maxTokens >= 2_048) return true;
  if (/\b(explique|detalhe|aprofunde|analise|compare|consequenc|causas?|efeitos?|impactos?|implicacoes|passo a passo)\b/.test(normalized)) {
    return true;
  }
  const wordCount = normalized.split(/\s+/g).filter(Boolean).length;
  return wordCount >= 16;
}

function shouldUseDegradedMode(error: unknown, resilienceConfig: RagResilienceConfig) {
  if (resilienceConfig.embeddingFailureMode !== "degrade") return false;
  if (!(error instanceof RagPipelineError)) return false;
  return error.code.startsWith("RAG_EMBEDDING_");
}

export class RagOrchestratorV2 {
  private readonly retriever: HybridRetrieverV2;
  private readonly reranker = new RerankerV2();
  private readonly packager = new ContextPackagerV2();
  private readonly citationAligner = new CitationAlignerV2();
  private readonly runAudit = new RunAuditRepositoryV2();
  private readonly writerPipeline = new WriterPipelineV2();

  constructor(
    private readonly embeddingClient: QueryEmbeddingClient = createQueryEmbeddingClient(),
    private readonly retrievalRepository: VectorRetrievalRepository = createVectorRetrievalRepository(),
    private readonly llmClient: VllmInternalClient = createVllmInternalClient(),
    private readonly generationConfig: RagGenerationConfig = loadRagGenerationConfig(),
    private readonly contextConfig: RagContextConfig = loadRagContextConfig(),
    private readonly resilienceConfig: RagResilienceConfig = loadRagResilienceConfig(),
    private readonly flags: RagPipelineFlags = loadRagPipelineFlags(),
  ) {
    this.retriever = new HybridRetrieverV2(this.retrievalRepository);
  }

  async query(input: OrchestratorV2Input): Promise<OrchestratorV2Result> {
    const startedAt = Date.now();
    const requestId = input.requestId || `rq-${Date.now()}`;
    const question = normalizeText(input.question);
    if (!question) {
      throw new RagPipelineError(400, "RAG_QUESTION_REQUIRED", "Campo question e obrigatorio.");
    }
    const trace = startTrace(requestId, "v2");
    const runId = trace.runId;
    const queryHash = hashText(question);

    let embeddingModel = "unavailable";
    let embeddingDimension = this.embeddingClient.getConfig().expectedDimension;
    let embeddingElapsedMs = 0;
    let queryVector: number[] | null = null;
    let degradedCode: string | null = null;
    let degradedMessage: string | null = null;

    try {
      const embed = await timedStage(trace, "embedding", async () => this.embeddingClient.embedQuery(question), {
        source: "query_embedding",
      });
      embeddingModel = embed.model;
      embeddingDimension = embed.dimension;
      embeddingElapsedMs = embed.elapsedMs;
      queryVector = embed.vector;
    } catch (error) {
      if (!shouldUseDegradedMode(error, this.resilienceConfig)) throw error;
      const pipelineError = error as RagPipelineError;
      degradedCode = pipelineError.code;
      degradedMessage = pipelineError.message;
      queryVector = null;
    }

    const safeTopK = Math.max(1, Math.min(100, Math.trunc(input.topK || 12)));
    const retrievalStartedAt = Date.now();
    const hybrid = await timedStage(
      trace,
      "hybrid_combine",
      async () =>
        this.retriever.search({
          queryText: question,
          queryVector: this.flags.hybridEnabled ? queryVector : null,
          topK: safeTopK,
          maxDistance: input.maxDistance,
          documentId: input.documentId,
          documentIds: input.documentIds,
          sourceType: input.sourceType,
          embeddingModel: input.retrievalEmbeddingModel || undefined,
          mmrEnabled: this.flags.mmrEnabled,
          cacheEnabled: this.flags.cacheEnabled,
        }),
      { topK: safeTopK },
    );
    const retrievalElapsedMs = Date.now() - retrievalStartedAt;

    const rerankResult = this.flags.rerankEnabled
      ? await timedStage(trace, "rerank", async () =>
          this.reranker.rerank({
            queryText: question,
            hits: hybrid.hits,
            maxCandidates: Math.max(20, safeTopK * 4),
            returnTop: safeTopK,
          }),
        )
      : {
          hits: hybrid.hits.slice(0, safeTopK),
          applied: false,
          beforeOrderChunkIds: hybrid.hits.map((row) => row.chunkId),
          afterOrderChunkIds: hybrid.hits.slice(0, safeTopK).map((row) => row.chunkId),
        };

    const maxTokens = clampMaxTokens(input.maxResponseTokens, this.generationConfig.maxTokens);
    const answerBudgetTokens = Math.max(128, maxTokens);
    const contextBudgetTokens = Math.max(384, Math.min(Math.trunc(maxTokens * 2.2), 8_192));
    const safetyMarginTokens = 192;
    const contextPack = await timedStage(
      trace,
      "context_pack",
      async () =>
        this.packager.pack({
          question,
          hits: rerankResult.hits,
          maxContextChars: this.contextConfig.maxChars,
          contextBudgetTokens,
          answerBudgetTokens,
          safetyMarginTokens,
        }),
      {
        selected: rerankResult.hits.length,
      },
    );

    let finalAnswer = "";
    let llmModel = this.llmClient.getConfig().model;
    let llmFinishReason: string | null = null;
    let llmUsage: {
      promptTokens: number | null;
      completionTokens: number | null;
      totalTokens: number | null;
    } = {
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
    };
    let llmElapsedMs = 0;
    let writerMode = false;
    let writerSections = 0;
    let writerLlmCalls = 0;

    if (shouldUseWriterMode(question, maxTokens, this.flags.writeModeEnabled)) {
      writerMode = true;
      const writerResult = await timedStage(
        trace,
        "writer_pipeline",
        async () =>
          this.writerPipeline.run({
            conversationId: requestId,
            runId,
            prompt: question,
            queryVector,
            llmClient: this.llmClient,
            history: Array.isArray(input.history) ? input.history : [],
            maxTokens,
            temperature: clampTemperature(input.temperature, this.generationConfig.temperature),
          }),
        {
          planSections: 0,
          maxTokens,
          selectedChunks: contextPack.selected.length,
        },
      );
      finalAnswer = writerResult.mergedText;
      llmModel = writerResult.usage.model || llmModel;
      llmFinishReason = "writer_pipeline";
      llmUsage = {
        promptTokens: writerResult.usage.promptTokens,
        completionTokens: writerResult.usage.completionTokens,
        totalTokens: writerResult.usage.totalTokens,
      };
      llmElapsedMs = writerResult.usage.elapsedMs;
      writerSections = writerResult.plan.length;
      writerLlmCalls = writerResult.usage.llmCalls;
    } else {
      const llmResult = await timedStage(
        trace,
        "generation",
        async () =>
          this.llmClient.completeWithContext({
            question,
            contextPack: contextPack.packedText,
            history: Array.isArray(input.history) ? input.history : [],
            maxTokens,
            temperature: clampTemperature(input.temperature, this.generationConfig.temperature),
            seed: normalizeSeed(input.seed, this.generationConfig.seed),
          }),
        {
          maxTokens,
        },
      );
      finalAnswer = llmResult.answer;
      llmModel = llmResult.model;
      llmFinishReason = llmResult.finishReason;
      llmUsage = llmResult.usage;
      llmElapsedMs = llmResult.elapsedMs;
    }

    let citationCount = 0;
    let uncoveredClaims = 0;
    if (this.flags.citationAlignmentEnabled) {
      const alignment = await timedStage(
        trace,
        "citations",
        async () => this.citationAligner.align(finalAnswer, contextPack.selected),
      );
      citationCount = alignment.citations.length;
      uncoveredClaims = alignment.uncoveredClaims.length;
      finalAnswer = alignment.annotatedAnswer;
      if (alignment.uncoveredClaims.length > 0) {
        finalAnswer = `${finalAnswer}\n\nNota: algumas afirmacoes nao tiveram evidencia direta nos trechos recuperados.`;
      }
      if (this.flags.generationRunAuditEnabled) {
        await this.runAudit.writeCitations(runId, alignment.citations);
      }
    }

    if (this.flags.retrievalRunAuditEnabled) {
      await this.runAudit.writeRetrievalRun({
        runId,
        requestId,
        queryText: question,
        queryHash,
        pipelineVersion: "v2",
        params: {
          topK: safeTopK,
          maxDistance: input.maxDistance ?? null,
          documentId: input.documentId ?? null,
          documentIds: normalizeDocIds(input.documentIds),
          sourceType: input.sourceType || null,
          embeddingModelFilter: input.retrievalEmbeddingModel || null,
        },
        results: {
          returnedChunks: rerankResult.hits.length,
          vectorCount: hybrid.vectorCount,
          lexicalCount: hybrid.lexicalCount,
          rerankApplied: rerankResult.applied,
          usedCache: hybrid.usedCache,
          chunkIds: rerankResult.hits.map((row) => row.chunkId),
        },
      });
    }
    if (this.flags.generationRunAuditEnabled) {
      await this.runAudit.writeGenerationRun({
        runId,
        requestId,
        pipelineVersion: "v2",
        mode: "chat",
        promptMeta: {
          contextChars: contextPack.packedText.length,
          selectedChunks: contextPack.selected.length,
          uncoveredClaims,
          writerMode,
          writerSections,
          writerLlmCalls,
        },
        tokenMeta: {
          maxTokens,
          usage: llmUsage,
        },
      });
    }

    emitTrace(trace, {
      requestId,
      runId,
      questionChars: question.length,
      selectedChunks: contextPack.selected.length,
    });

    return {
      answer: finalAnswer,
      metadata: {
        resilience: {
          embeddingFailureMode: this.resilienceConfig.embeddingFailureMode,
          degraded: Boolean(degradedCode),
          degradedCode,
          degradedMessage,
          usedDocumentScopeFallback: false,
        },
        retrieval: {
          topK: safeTopK,
          maxDistance: input.maxDistance ?? null,
          strategy: "hybrid_v2",
          filters: {
            documentId: input.documentId ?? null,
            documentIds: normalizeDocIds(input.documentIds),
            sourceType: input.sourceType || null,
            embeddingModel: input.retrievalEmbeddingModel || null,
          },
          returnedChunks: rerankResult.hits.length,
          vectorCount: hybrid.vectorCount,
          lexicalCount: hybrid.lexicalCount,
          rerankApplied: rerankResult.applied,
        },
        contextPack: {
          selectedChunks: contextPack.selected.length,
          omittedChunks: contextPack.omitted,
          maxChars: contextPack.budget.maxContextChars,
          usedChars: contextPack.usedChars,
          truncated: contextPack.omitted > 0,
          budget: {
            contextBudgetTokens: contextPack.budget.contextBudgetTokens,
            answerBudgetTokens: contextPack.budget.answerBudgetTokens,
            safetyMarginTokens: contextPack.budget.safetyMarginTokens,
          },
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
        citations: {
          enabled: this.flags.citationAlignmentEnabled,
          count: citationCount,
          uncoveredClaims,
        },
        queryEmbedding: {
          model: embeddingModel,
          dimension: embeddingDimension,
        },
        llm: {
          provider: "vllm_internal",
          baseUrl: this.llmClient.getConfig().baseUrl,
          model: llmModel,
          maxTokens,
          temperature: clampTemperature(input.temperature, this.generationConfig.temperature),
          seed: normalizeSeed(input.seed, this.generationConfig.seed),
          finishReason: llmFinishReason,
          usage: llmUsage,
        },
        timingsMs: {
          embedding: embeddingElapsedMs,
          retrieval: retrievalElapsedMs,
          contextAssembly: trace.stages.find((row) => row.stage === "context_pack")?.elapsedMs || 0,
          llm: llmElapsedMs,
          total: Date.now() - startedAt,
        },
        v2: {
          runId,
          pipelineVersion: "v2",
          queryHash,
          traceStages: trace.stages.map((row) => ({ stage: row.stage, elapsedMs: row.elapsedMs })),
          writerMode,
          writerSections,
          writerLlmCalls,
        },
      },
    };
  }
}
