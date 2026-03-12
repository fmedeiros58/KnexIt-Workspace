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
import { TextAnalysisModule, type AnalysisDescriptor, type TextAnalysisPipelineStrategy } from "@/core/rag/v2/analysis/text_analysis_module";
import { CitationAlignerV2 } from "@/core/rag/v2/citations/aligner_v2";
import { ContextPackagerV2 } from "@/core/rag/v2/context/packager_v2";
import { emitTrace, hashText, startTrace, timedStage } from "@/core/rag/v2/observability/logger_v2";
import { RunAuditRepositoryV2 } from "@/core/rag/v2/observability/run_audit_repository_v2";
import { progressEventStore } from "@/core/rag/v2/progress/event_store";
import { ProgressMessageFactory } from "@/core/rag/v2/progress/message_factory";
import {
  createProgressTimestamp,
  type PipelineProgressEventType,
  type PipelineProgressStage,
  type ProgressTarget,
  type RagPipelineProgressEvent,
} from "@/core/rag/v2/progress/types";
import { HybridRetrieverV2 } from "@/core/rag/v2/retrieval/hybrid_v2";
import { RerankerV2 } from "@/core/rag/v2/rerank/reranker_v2";
import { WriterPipelineV2, type WriterPipelineProgressEvent } from "@/core/rag/v2/writer/pipeline_v2";

export type OrchestratorV2Input = {
  requestId: string;
  question: string;
  history: RagChatHistoryItem[];
  topK?: number;
  maxDistance?: number | null;
  documentId?: number;
  documentIds?: number[];
  priorityDocumentIds?: number[];
  sourceType?: string;
  retrievalEmbeddingModel?: string;
  preferredResponseLanguageId?: string;
  strictDocumentGrounding?: boolean;
  maxResponseTokens?: number;
  temperature?: number;
  seed?: number | null;
  anmEngineMode?: "direct" | "anm";
  anmBaseUrl?: string;
  anmTimeoutMs?: number;
  anmSoftTimeoutMs?: number;
  anmFallbackToDirect?: boolean;
  onProgress?: (event: OrchestratorV2ProgressEvent) => void | Promise<void>;
  onFinalDelta?: (delta: string) => void | Promise<void>;
};

export type OrchestratorV2ProgressEvent = {
  phase: "pipeline_progress" | "writer_progress" | "final";
  stage: WriterPipelineProgressEvent["stage"] | PipelineProgressStage;
  message: string;
  requestId: string;
  runId: string;
  elapsedMs: number;
  progress?: RagPipelineProgressEvent;
  sectionIndex?: number;
  sectionTotal?: number;
  sectionTitle?: string;
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
          pipelineStrategy: TextAnalysisPipelineStrategy;
          analysis: AnalysisDescriptor;
          writerMode: boolean;
          writerSections: number;
          writerLlmCalls: number;
          writerReinforcementCalls: number;
          multicallLockEnabled: boolean;
          multicallMinWriterCalls: number;
        };
      };
};

function normalizeText(value: string) {
  return `${value || ""}`.trim();
}

function parsePositiveInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function resolveMulticallLockConfig() {
  const enabled = parseBoolean(process.env.RAG_V2_MULTICALL_LOCK_ENABLED, true);
  const minWriterCalls = parsePositiveInt(process.env.RAG_V2_MULTICALL_MIN_WRITER_CALLS, 3, 2, 12);
  const maxReinforcementPasses = parsePositiveInt(process.env.RAG_V2_MULTICALL_MAX_REINFORCEMENT_PASSES, 4, 1, 12);
  return { enabled, minWriterCalls, maxReinforcementPasses };
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

function normalizeDocId(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.trunc(parsed);
  return normalized > 0 ? normalized : null;
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

function normalizeLanguageTag(value: string | undefined) {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (!normalized) return "pt-BR";
  if (normalized.startsWith("en")) return "en";
  return "pt-BR";
}

function resolveStagePercent(stage: PipelineProgressStage) {
  switch (stage) {
    case "INGEST":
      return 5;
    case "PARSE":
      return 14;
    case "STRUCTURE":
      return 20;
    case "EMBED":
      return 30;
    case "RETRIEVE":
      return 44;
    case "RERANK":
      return 56;
    case "PACK":
      return 68;
    case "DRAFT":
      return 82;
    case "CITE_AUDIT":
      return 92;
    case "MERGE":
      return 97;
    case "FINALIZE":
      return 100;
    case "OCR":
    case "CHUNK":
      return 24;
    default:
      return 0;
  }
}

function createFallbackAnalysisDescriptor(question: string, languageTag: string): AnalysisDescriptor {
  return {
    doc_profile: {
      doc_name: "documento_em_escopo",
      page_total: 0,
      language: languageTag,
      has_ocr: false,
      headings_confidence: 0,
      structure: [],
      key_terms: [],
      entities: {
        people: [],
        orgs: [],
        places: [],
      },
    },
    task_profile: {
      goal: normalizeText(question).slice(0, 220),
      output_format: "academico_generico",
      depth: "medium",
      citations_required: false,
    },
    complexity: {
      score_0_100: 50,
      reasons: ["text_analysis_module_disabled"],
      recommended_pipeline: "STANDARD",
    },
  };
}

function normalizeParagraphKey(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeFinalAnswer(answer: string, question: string) {
  const raw = normalizeText(answer);
  if (!raw) return "";
  const questionKey = normalizeParagraphKey(question);
  const directiveMarkers = [
    "pergunta original",
    "responda de forma objetiva",
    "coerente com as evidencias",
    "mantenha o idioma da pergunta",
    "evite repetir argumentos",
  ];
  const paragraphs = raw
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/g)
    .map((row) => row.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const filtered: string[] = [];
  for (const paragraph of paragraphs) {
    const key = normalizeParagraphKey(paragraph);
    if (!key) continue;
    if (questionKey && key === questionKey) continue;
    if (key.startsWith("pergunta original")) continue;
    if (questionKey && key.includes(`pergunta original ${questionKey.slice(0, 140)}`)) continue;
    const markerHits = directiveMarkers.reduce((acc, marker) => (key.includes(marker) ? acc + 1 : acc), 0);
    if (markerHits >= 2 && key.length < 680) continue;
    const dedupeKey = key.slice(0, 260);
    if (dedupeKey.length > 48 && seen.has(dedupeKey)) continue;
    if (dedupeKey.length > 48) seen.add(dedupeKey);
    filtered.push(paragraph);
  }
  const rebuilt = filtered.join("\n\n").trim();
  return rebuilt || raw;
}

async function streamCompletionToText(
  stream: ReadableStream<Uint8Array>,
  onDelta?: (delta: string) => void | Promise<void>,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let merged = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || !value.length) continue;
      const delta = decoder.decode(value, { stream: true });
      if (!delta) continue;
      merged += delta;
      if (onDelta) await onDelta(delta);
    }
    const tail = decoder.decode();
    if (tail) {
      merged += tail;
      if (onDelta) await onDelta(tail);
    }
  } finally {
    reader.releaseLock();
  }
  return normalizeText(merged);
}

export class RagOrchestratorV2 {
  private readonly retriever: HybridRetrieverV2;
  private readonly reranker = new RerankerV2();
  private readonly packager = new ContextPackagerV2();
  private readonly citationAligner = new CitationAlignerV2();
  private readonly runAudit = new RunAuditRepositoryV2();
  private readonly writerPipeline = new WriterPipelineV2();
  private readonly textAnalysis = new TextAnalysisModule();
  private readonly progressMessageFactory = new ProgressMessageFactory();

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
    const maxTokens = clampMaxTokens(input.maxResponseTokens, this.generationConfig.maxTokens);
    const safeTopKRequested = Math.max(1, Math.min(100, Math.trunc(input.topK || 12)));
    const scopedDocumentIds = normalizeDocIds(input.documentIds);
    const scopedDocumentId = normalizeDocId(input.documentId);
    const priorityDocumentIds = normalizeDocIds(input.priorityDocumentIds);
    const hasDocumentScope = scopedDocumentIds.length > 0 || scopedDocumentId !== null;
    const strictDocumentGrounding = input.strictDocumentGrounding ?? hasDocumentScope;
    if (strictDocumentGrounding && !hasDocumentScope) {
      throw new RagPipelineError(
        422,
        "RAG_DOCUMENT_SCOPE_REQUIRED",
        "Modo de grounding estrito requer documento(s) selecionado(s) no composer.",
      );
    }
    const progressEnabled = parseBoolean(process.env.PROGRESS_STREAM_ENABLED, true);
    const analysisEnabled = parseBoolean(process.env.TEXT_ANALYSIS_MODULE_ENABLED, true);
    const dynamicMessagesEnabled = parseBoolean(process.env.DYNAMIC_PROGRESS_MESSAGES, true);

    let analysis = analysisEnabled
      ? this.textAnalysis.analyze({
          question,
          history: Array.isArray(input.history) ? input.history : [],
          documentId: scopedDocumentId ?? undefined,
          documentIds: scopedDocumentIds,
          strictDocumentGrounding,
          maxResponseTokens: maxTokens,
          topK: safeTopKRequested,
          preferredResponseLanguageId: input.preferredResponseLanguageId,
        })
      : createFallbackAnalysisDescriptor(question, normalizeLanguageTag(input.preferredResponseLanguageId));
    let pipelineStrategy = analysis.complexity.recommended_pipeline;
    const languageTag = normalizeLanguageTag(input.preferredResponseLanguageId || analysis.doc_profile.language);
    const userGoalShort = analysis.task_profile.goal;

    const emitProgress = async (event: OrchestratorV2ProgressEvent) => {
      if (!input.onProgress) return;
      try {
        await input.onProgress(event);
      } catch {
        // best effort: progresso nao deve quebrar execucao
      }
    };

    const emitPipelineProgress = async (opts: {
      type?: PipelineProgressEventType;
      stage: PipelineProgressStage;
      substage?: string;
      target?: ProgressTarget;
      counters?: Record<string, number>;
      progressPct?: number;
      message?: string;
      detail?: Record<string, unknown>;
    }) => {
      const stage = opts.stage;
      const elapsedMs = Date.now() - startedAt;
      const target = opts.target || {};
      const counters = opts.counters;
      const message =
        opts.message ||
        (dynamicMessagesEnabled
          ? this.progressMessageFactory.build({
              requestId,
              stage,
              substage: opts.substage,
              langTag: languageTag,
              target,
              counters,
              userGoalShort,
            })
          : "");
      const payload: RagPipelineProgressEvent = {
        type: opts.type || "progress",
        request_id: requestId,
        run_id: runId,
        ts: createProgressTimestamp(),
        elapsed_ms: elapsedMs,
        stage,
        substage: opts.substage || "default",
        target,
        progress_pct: Number.isFinite(opts.progressPct as number) ? Number(opts.progressPct) : resolveStagePercent(stage),
        counters,
        message,
        detail: opts.detail,
      };
      if (progressEnabled) {
        progressEventStore.append(payload);
        await emitProgress({
          phase: stage === "FINALIZE" ? "final" : "pipeline_progress",
          stage,
          message,
          requestId,
          runId,
          elapsedMs,
          progress: payload,
        });
      }
      return payload;
    };

    await emitPipelineProgress({
      stage: "INGEST",
      substage: "request_received",
      target: {
        doc_id: scopedDocumentId ? `${scopedDocumentId}` : undefined,
      },
      detail: {
        pipeline_strategy: pipelineStrategy,
        strict_document_grounding: strictDocumentGrounding,
      },
    });
    await emitPipelineProgress({
      stage: "PARSE",
      substage: "question_parse",
      target: {
        doc_name: hasDocumentScope ? "documento_em_escopo" : "base_geral",
      },
      detail: {
        question_chars: question.length,
      },
    });
    await emitPipelineProgress({
      stage: "STRUCTURE",
      substage: "text_analysis",
      message: this.progressMessageFactory.build({
        requestId,
        stage: "STRUCTURE",
        langTag: languageTag,
        userGoalShort,
        target: {
          doc_name: hasDocumentScope ? "documento_em_escopo" : "base_geral",
          page: { total: analysis.doc_profile.page_total || undefined },
        },
      }),
      detail: {
        complexity_score: analysis.complexity.score_0_100,
        complexity_reasons: analysis.complexity.reasons,
        recommended_pipeline: pipelineStrategy,
      },
    });

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

    const safeTopK =
      pipelineStrategy === "FAST"
        ? Math.max(6, Math.min(12, safeTopKRequested))
        : pipelineStrategy === "DEEP"
          ? Math.max(20, Math.min(48, safeTopKRequested))
          : Math.max(10, Math.min(24, safeTopKRequested));
    const retrievalRerankEnabled =
      pipelineStrategy === "FAST" ? false : this.flags.rerankEnabled || pipelineStrategy === "DEEP";
    const retrievalMmrEnabled = pipelineStrategy === "FAST" ? false : this.flags.mmrEnabled;

    await emitPipelineProgress({
      stage: "EMBED",
      substage: "query_embedding",
      detail: {
        model: embeddingModel,
        dimension: embeddingDimension,
        degraded: Boolean(degradedCode),
      },
    });
    await emitPipelineProgress({
      stage: "RETRIEVE",
      substage: "hybrid_search_start",
      target: {
        doc_id: scopedDocumentId ? `${scopedDocumentId}` : undefined,
      },
      counters: {
        top_k: safeTopK,
      },
    });

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
          documentId: scopedDocumentId ?? undefined,
          documentIds: scopedDocumentIds.length ? scopedDocumentIds : undefined,
          priorityDocumentIds: priorityDocumentIds.length ? priorityDocumentIds : undefined,
          sourceType: input.sourceType,
          embeddingModel: input.retrievalEmbeddingModel || undefined,
          mmrEnabled: retrievalMmrEnabled,
          cacheEnabled: this.flags.cacheEnabled,
          allowScopeFallback: !strictDocumentGrounding,
        }),
      { topK: safeTopK },
    );
    const retrievalElapsedMs = Date.now() - retrievalStartedAt;
    await emitPipelineProgress({
      stage: "RETRIEVE",
      substage: "hybrid_search_done",
      counters: {
        candidates: hybrid.hits.length,
        vector_hits: hybrid.vectorCount,
        lexical_hits: hybrid.lexicalCount,
      },
      detail: {
        used_scope_fallback: hybrid.usedScopeFallback,
      },
    });

    const rerankResult = retrievalRerankEnabled
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
    if (rerankResult.applied) {
      await emitPipelineProgress({
        stage: "RERANK",
        substage: "rerank_done",
        counters: {
          selected: rerankResult.hits.length,
        },
      });
    }
    const usedDocumentScopeFallback =
      Boolean(hybrid.usedScopeFallback) || rerankResult.hits.some((row) => row.rankSource === "scope_fallback");

    if (analysisEnabled) {
      analysis = this.textAnalysis.enrichWithHits(analysis, rerankResult.hits);
      pipelineStrategy = analysis.complexity.recommended_pipeline;
    }

    if (
      strictDocumentGrounding &&
      rerankResult.hits.length === 0 &&
      hybrid.vectorCount === 0 &&
      queryVector &&
      queryVector.length > 0
    ) {
      throw new RagPipelineError(
        422,
        "RAG_DOCUMENT_SCOPE_NO_HITS",
        "Nenhum trecho indexado foi encontrado para os documentos selecionados. Aguarde os embeddings concluirem ou revise o arquivo enviado.",
      );
    }
    const answerBudgetTokens = Math.max(128, maxTokens);
    const contextBudgetTokens = Math.max(384, Math.min(Math.trunc(maxTokens * 2.4), 16_384));
    const safetyMarginTokens = 192;
    await emitPipelineProgress({
      stage: "CHUNK",
      substage: "candidate_chunk_projection",
      counters: {
        chunks_total: rerankResult.hits.length,
      },
      target: {
        doc_name: analysis.doc_profile.doc_name,
      },
    });

    await emitPipelineProgress({
      stage: "PACK",
      substage: "context_pack_start",
      counters: {
        chunks_total: rerankResult.hits.length,
      },
    });
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
    await emitPipelineProgress({
      stage: "PACK",
      substage: "context_pack_done",
      target: {
        doc_name: analysis.doc_profile.doc_name,
        page: {
          total: analysis.doc_profile.page_total || undefined,
        },
      },
      counters: {
        chunks_done: contextPack.selected.length,
        chunks_total: rerankResult.hits.length,
      },
      detail: {
        used_chars: contextPack.usedChars,
        omitted_chunks: contextPack.omitted,
      },
    });
    if (hasDocumentScope && contextPack.selected.length === 0) {
      throw new RagPipelineError(
        422,
        "RAG_DOCUMENT_SCOPE_EMPTY_CONTEXT",
        "Nao encontrei trechos suficientes do documento em escopo para gerar resposta confiavel.",
      );
    }

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
    let writerReinforcementCalls = 0;
    const multicallLock = resolveMulticallLockConfig();

    writerMode = pipelineStrategy !== "FAST" && shouldUseWriterMode(question, maxTokens, true);
    if (writerMode) {
      await emitPipelineProgress({
        stage: "DRAFT",
        substage: "writer_pipeline_start",
        target: {
          doc_name: analysis.doc_profile.doc_name,
        },
        detail: {
          strategy: pipelineStrategy,
        },
      });
      const writerResult = await timedStage(
        trace,
        "writer_pipeline",
        async () =>
          this.writerPipeline.run({
            conversationId: requestId,
            runId,
            prompt: question,
            queryVector,
            documentId: input.documentId,
            documentIds: input.documentIds,
            priorityDocumentIds: input.priorityDocumentIds,
            sourceType: input.sourceType,
            retrievalEmbeddingModel: input.retrievalEmbeddingModel,
            preferredResponseLanguageId: input.preferredResponseLanguageId,
            strictDocumentGrounding,
            maxDistance: input.maxDistance,
            llmClient: this.llmClient,
            history: Array.isArray(input.history) ? input.history : [],
            maxTokens,
            temperature: clampTemperature(input.temperature, this.generationConfig.temperature),
            anmEngineMode: input.anmEngineMode,
            anmBaseUrl: input.anmBaseUrl,
            anmTimeoutMs: input.anmTimeoutMs,
            anmSoftTimeoutMs: input.anmSoftTimeoutMs,
            anmFallbackToDirect: input.anmFallbackToDirect,
            onProgress: async (event) => {
              const stage = event.stage === "merge_start" || event.stage === "merge_done" ? "MERGE" : "DRAFT";
              const message = event.message;
              const progressPayload: RagPipelineProgressEvent = {
                type: "progress",
                request_id: requestId,
                run_id: runId,
                ts: createProgressTimestamp(),
                elapsed_ms: Date.now() - startedAt,
                stage,
                substage: event.stage,
                target: {
                  doc_name: analysis.doc_profile.doc_name,
                  section: event.sectionTitle || undefined,
                },
                progress_pct: resolveStagePercent(stage),
                message,
                counters:
                  Number.isFinite(event.sectionIndex as number) && Number.isFinite(event.sectionTotal as number)
                    ? {
                        section_current: Math.max(0, Math.trunc(Number(event.sectionIndex))),
                        section_total: Math.max(0, Math.trunc(Number(event.sectionTotal))),
                      }
                    : undefined,
              };
              if (progressEnabled) {
                progressEventStore.append(progressPayload);
                await emitProgress({
                  phase: "writer_progress",
                  stage: event.stage,
                  message,
                  requestId,
                  runId,
                  elapsedMs: progressPayload.elapsed_ms,
                  progress: progressPayload,
                  sectionIndex: event.sectionIndex,
                  sectionTotal: event.sectionTotal,
                  sectionTitle: event.sectionTitle,
                });
              }
            },
            onFinalDelta: input.onFinalDelta,
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
      await emitPipelineProgress({
        stage: "DRAFT",
        substage: "writer_pipeline_done",
        counters: {
          section_total: writerSections,
          llm_calls: writerLlmCalls,
        },
      });
    } else {
      await emitPipelineProgress({
        stage: "DRAFT",
        substage: "single_pass_start",
        detail: {
          strategy: pipelineStrategy,
        },
      });
      const singlePassQuestion = question;
      if (input.onFinalDelta) {
        const singlePassStartedAt = Date.now();
        const streamed = await timedStage(trace, "writer_merge", async () => {
          const stream = await this.llmClient.streamWithContext({
            question: singlePassQuestion,
            contextPack: contextPack.packedText,
            history: Array.isArray(input.history) ? input.history : [],
            maxTokens,
            temperature: clampTemperature(input.temperature, this.generationConfig.temperature),
            seed: normalizeSeed(input.seed, this.generationConfig.seed),
            followupMode: "omit",
            responseLanguageId: input.preferredResponseLanguageId,
            anmEngineMode: input.anmEngineMode,
            anmBaseUrl: input.anmBaseUrl,
            anmTimeoutMs: input.anmTimeoutMs,
            anmSoftTimeoutMs: input.anmSoftTimeoutMs,
            anmFallbackToDirect: input.anmFallbackToDirect,
          });
          const mergedText = await streamCompletionToText(stream, async (delta) => {
            await input.onFinalDelta?.(delta);
          });
          return { mergedText };
        });
        finalAnswer = streamed.mergedText;
        llmFinishReason = "single_pass_stream";
        llmUsage = {
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
        };
        llmElapsedMs = Date.now() - singlePassStartedAt;
      } else {
        const singlePass = await timedStage(
          trace,
          "writer_merge",
          async () =>
            this.llmClient.completeWithContext({
              question: singlePassQuestion,
              contextPack: contextPack.packedText,
              history: Array.isArray(input.history) ? input.history : [],
              maxTokens,
              temperature: clampTemperature(input.temperature, this.generationConfig.temperature),
              seed: normalizeSeed(input.seed, this.generationConfig.seed),
              followupMode: "omit",
              responseLanguageId: input.preferredResponseLanguageId,
              anmEngineMode: input.anmEngineMode,
              anmBaseUrl: input.anmBaseUrl,
              anmTimeoutMs: input.anmTimeoutMs,
              anmSoftTimeoutMs: input.anmSoftTimeoutMs,
              anmFallbackToDirect: input.anmFallbackToDirect,
            }),
        );
        finalAnswer = `${singlePass.answer || ""}`.trim();
        llmModel = singlePass.model || llmModel;
        llmFinishReason = singlePass.finishReason || "single_pass";
        llmUsage = singlePass.usage;
        llmElapsedMs = singlePass.elapsedMs;
      }
      writerSections = 1;
      writerLlmCalls = 1;
      await emitPipelineProgress({
        stage: "DRAFT",
        substage: "single_pass_done",
        counters: {
          llm_calls: 1,
        },
      });
    }

    if (writerMode && multicallLock.enabled && writerLlmCalls < multicallLock.minWriterCalls) {
      const missingCalls = Math.max(0, multicallLock.minWriterCalls - writerLlmCalls);
      const reinforcementCalls = Math.min(missingCalls, multicallLock.maxReinforcementPasses);
      let aggregatedPromptTokens = Number(llmUsage.promptTokens || 0);
      let aggregatedCompletionTokens = Number(llmUsage.completionTokens || 0);
      let aggregatedTotalTokens = Number(llmUsage.totalTokens || 0);
      let hasUsage = llmUsage.promptTokens !== null || llmUsage.completionTokens !== null || llmUsage.totalTokens !== null;

      for (let pass = 1; pass <= reinforcementCalls; pass += 1) {
        await emitPipelineProgress({
          stage: "MERGE",
          substage: "multicall_reinforcement_start",
          message: `Passe de reforco multicall ${pass}/${reinforcementCalls} iniciado.`,
          target: {
            doc_name: analysis.doc_profile.doc_name,
            section: "reforco_multicall",
          },
          counters: {
            section_current: pass,
            section_total: reinforcementCalls,
          },
        });
        const reinforced = await timedStage(
          trace,
          "writer_merge",
          async () =>
            this.llmClient.completeWithContext({
              question: [
                `Pergunta original: ${question}`,
                "Aprimore a resposta mantendo o mesmo idioma da pergunta.",
                "Aumente profundidade sem repetir paragrafo ja coberto.",
                "Preserve consistencia factual com o contexto recuperado.",
                "Nao inclua meta-comentarios sobre consolidacao, secoes, prompt ou instrucoes internas.",
              ].join(" "),
              contextPack: finalAnswer,
              history: Array.isArray(input.history) ? input.history : [],
              maxTokens,
              temperature: clampTemperature(input.temperature, this.generationConfig.temperature),
              seed: normalizeSeed(input.seed, this.generationConfig.seed),
              followupMode: "omit",
              anmEngineMode: input.anmEngineMode,
              anmBaseUrl: input.anmBaseUrl,
              anmTimeoutMs: input.anmTimeoutMs,
              anmSoftTimeoutMs: input.anmSoftTimeoutMs,
              anmFallbackToDirect: input.anmFallbackToDirect,
            }),
          {
            lockPass: pass,
            lockMinCalls: multicallLock.minWriterCalls,
          },
        );
        finalAnswer = `${reinforced.answer || ""}`.trim() || finalAnswer;
        llmModel = reinforced.model || llmModel;
        llmFinishReason = reinforced.finishReason || llmFinishReason;
        llmElapsedMs += reinforced.elapsedMs;
        writerLlmCalls += 1;
        writerReinforcementCalls += 1;
        if (
          reinforced.usage.promptTokens !== null ||
          reinforced.usage.completionTokens !== null ||
          reinforced.usage.totalTokens !== null
        ) {
          hasUsage = true;
        }
        aggregatedPromptTokens += Number(reinforced.usage.promptTokens || 0);
        aggregatedCompletionTokens += Number(reinforced.usage.completionTokens || 0);
        aggregatedTotalTokens += Number(reinforced.usage.totalTokens || 0);
        await emitPipelineProgress({
          stage: "MERGE",
          substage: "multicall_reinforcement_done",
          message: `Passe de reforco multicall ${pass}/${reinforcementCalls} concluido.`,
          target: {
            doc_name: analysis.doc_profile.doc_name,
            section: "reforco_multicall",
          },
          counters: {
            section_current: pass,
            section_total: reinforcementCalls,
          },
        });
      }
      llmUsage = hasUsage
        ? {
            promptTokens: aggregatedPromptTokens,
            completionTokens: aggregatedCompletionTokens,
            totalTokens: aggregatedTotalTokens,
          }
        : {
            promptTokens: null,
            completionTokens: null,
            totalTokens: null,
          };
      if (writerLlmCalls < multicallLock.minWriterCalls) {
        throw new RagPipelineError(
          500,
          "RAG_V2_MULTICALL_LOCK_VIOLATION",
          `Multicall lock nao atendido: writerLlmCalls=${writerLlmCalls}, minimo=${multicallLock.minWriterCalls}.`,
        );
      }
    }

    let citationCount = 0;
    let uncoveredClaims = 0;
    if (this.flags.citationAlignmentEnabled) {
      await emitPipelineProgress({
        stage: "CITE_AUDIT",
        substage: "citation_alignment_start",
        counters: {
          chunks_total: contextPack.selected.length,
        },
      });
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
      await emitPipelineProgress({
        stage: "CITE_AUDIT",
        substage: "citation_alignment_done",
        counters: {
          citation_count: citationCount,
          uncovered_claims: uncoveredClaims,
        },
      });
    }
    finalAnswer = sanitizeFinalAnswer(finalAnswer, question);

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
          documentId: scopedDocumentId,
          documentIds: scopedDocumentIds,
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
          writerReinforcementCalls,
          multicallLockEnabled: multicallLock.enabled,
          multicallMinWriterCalls: multicallLock.minWriterCalls,
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

    await emitPipelineProgress({
      type: "final",
      stage: "FINALIZE",
      substage: "response_ready",
      target: {
        doc_name: analysis.doc_profile.doc_name,
        page: {
          total: analysis.doc_profile.page_total || undefined,
        },
      },
      counters: {
        llm_calls: writerLlmCalls,
        citations: citationCount,
      },
      progressPct: 100,
      detail: {
        strategy: pipelineStrategy,
      },
    });

    return {
      answer: finalAnswer,
      metadata: {
        resilience: {
          embeddingFailureMode: this.resilienceConfig.embeddingFailureMode,
          degraded: Boolean(degradedCode),
          degradedCode,
          degradedMessage,
          usedDocumentScopeFallback,
        },
        retrieval: {
          topK: safeTopK,
          maxDistance: input.maxDistance ?? null,
          strategy: "hybrid_v2",
          filters: {
            documentId: scopedDocumentId,
            documentIds: scopedDocumentIds,
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
          pipelineStrategy,
          analysis,
          writerMode,
          writerSections,
          writerLlmCalls,
          writerReinforcementCalls,
          multicallLockEnabled: multicallLock.enabled,
          multicallMinWriterCalls: multicallLock.minWriterCalls,
        },
      },
    };
  }
}

