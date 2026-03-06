import {
  createVectorRetrievalRepository,
  type VectorRetrievalRepository,
  type VectorTopKResult,
} from "../database/vector-retrieval-repository";
import { resolveVectorSearchParams, type VectorSearchParams } from "../database/vector-search-params";
import { logger } from "../utils/logger";
import { RagPipelineError } from "./rag-errors";

export type RagRetrievalInput = {
  queryVector: number[];
  topK?: number;
  maxDistance?: number | null;
  documentId?: number;
  documentIds?: number[];
  sourceType?: string;
  embeddingModel?: string;
};

export type RagRetrievalResult = {
  hits: VectorTopKResult[];
  params: VectorSearchParams;
  elapsedMs: number;
};

export class RagRetrievalService {
  constructor(private readonly repository: VectorRetrievalRepository = createVectorRetrievalRepository()) {}

  async search(input: RagRetrievalInput): Promise<RagRetrievalResult> {
    if (!Array.isArray(input.queryVector) || !input.queryVector.length) {
      throw new RagPipelineError(400, "RAG_QUERY_VECTOR_REQUIRED", "queryVector obrigatorio para o retrieval vetorial.");
    }

    const params = resolveVectorSearchParams({ topK: input.topK, maxDistance: input.maxDistance });
    const startedAt = Date.now();
    logger.debug("RAG_RETRIEVAL_START", {
      topK: params.topK,
      maxDistance: params.maxDistance,
      documentId: input.documentId ?? null,
      documentIds: Array.isArray(input.documentIds) ? input.documentIds : null,
      sourceType: input.sourceType || null,
      embeddingModel: input.embeddingModel || null,
    });
    try {
      const hits = await this.repository.searchTopK({
        queryVector: input.queryVector,
        topK: params.topK,
        maxDistance: params.maxDistance,
        documentId: input.documentId,
        documentIds: input.documentIds,
        sourceType: input.sourceType,
        embeddingModel: input.embeddingModel,
      });
      logger.debug("RAG_RETRIEVAL_DONE", {
        topK: params.topK,
        hits: hits.length,
        elapsedMs: Date.now() - startedAt,
      });
      return {
        hits,
        params,
        elapsedMs: Date.now() - startedAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido no retrieval vetorial.";
      logger.error("RAG_RETRIEVAL_DB_ERROR", {
        topK: params.topK,
        maxDistance: params.maxDistance,
        documentId: input.documentId ?? null,
        documentIds: Array.isArray(input.documentIds) ? input.documentIds : null,
        sourceType: input.sourceType || null,
        embeddingModel: input.embeddingModel || null,
      });
      throw new RagPipelineError(500, "RAG_RETRIEVAL_ERROR", message);
    }
  }
}

export function createRagRetrievalService() {
  return new RagRetrievalService(createVectorRetrievalRepository());
}
