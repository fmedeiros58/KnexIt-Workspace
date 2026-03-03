import { createVectorDatabaseClient, type VectorDatabaseClient } from "../database/vector-client";
import { logger } from "../utils/logger";
import { createQueryEmbeddingClient, type QueryEmbeddingClient } from "./embedding-client";
import { RagPipelineError } from "./rag-errors";

type ChunkRow = {
  chunk_id: string | number;
  text: string;
};

export type DocumentChunkEmbeddingResult = {
  documentId: number;
  totalChunks: number;
  pendingChunks: number;
  embeddedChunks: number;
  skippedChunks: number;
  failedChunks: number;
  embeddingModel: string;
  status: "completed" | "partial" | "failed";
};

function toInteger(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function vectorToLiteral(vector: number[]) {
  return `[${vector.join(",")}]`;
}

export class ChunkEmbeddingService {
  constructor(
    private readonly vectorDb: VectorDatabaseClient = createVectorDatabaseClient(),
    private readonly embeddingClient: QueryEmbeddingClient = createQueryEmbeddingClient(),
  ) {}

  async indexDocumentChunks(documentId: number, batchSize = 16): Promise<DocumentChunkEmbeddingResult> {
    if (!Number.isInteger(documentId) || documentId <= 0) {
      throw new RagPipelineError(400, "RAG_EMBED_DOCUMENT_ID_INVALID", "documentId invalido para indexacao de embeddings.");
    }

    const safeBatchSize = Math.max(1, Math.min(256, Math.trunc(batchSize)));
    const totalChunksQuery = await this.vectorDb.query<{ total: string | number }>(
      "select count(*) as total from vector_store.document_chunks where document_id = $1",
      [documentId],
    );
    const totalChunks = toInteger(totalChunksQuery.rows[0]?.total, 0);
    if (!totalChunks) {
      await this.markDocumentEmbeddingStatus(documentId, "failed", {
        message: "Documento sem chunks para indexacao de embedding.",
        embedding_model: this.embeddingClient.getConfig().model,
      });
      throw new RagPipelineError(422, "RAG_EMBED_NO_CHUNKS", "Documento sem chunks para indexacao de embeddings.");
    }

    const pendingQuery = await this.vectorDb.query<ChunkRow>(
      `
      select dc.id as chunk_id, dc.text
      from vector_store.document_chunks dc
      left join vector_store.chunk_embeddings ce
        on ce.chunk_id = dc.id
      where dc.document_id = $1
        and ce.chunk_id is null
      order by dc.chunk_index asc
      `,
      [documentId],
    );

    const pending = pendingQuery.rows;
    if (!pending.length) {
      await this.markDocumentEmbeddingStatus(documentId, "completed", {
        embedded_chunks: totalChunks,
        pending_chunks: 0,
        embedding_model: this.embeddingClient.getConfig().model,
      });
      return {
        documentId,
        totalChunks,
        pendingChunks: 0,
        embeddedChunks: 0,
        skippedChunks: totalChunks,
        failedChunks: 0,
        embeddingModel: this.embeddingClient.getConfig().model,
        status: "completed",
      };
    }

    logger.info("RAG_EMBED_INDEX_START", {
      documentId,
      totalChunks,
      pendingChunks: pending.length,
      batchSize: safeBatchSize,
    });

    let embeddedChunks = 0;
    let failedChunks = 0;
    let usedEmbeddingModel = this.embeddingClient.getConfig().model;

    for (let cursor = 0; cursor < pending.length; cursor += safeBatchSize) {
      const batch = pending.slice(cursor, cursor + safeBatchSize);
      const texts = batch.map((row) => row.text || "");
      try {
        const embeddings = await this.embeddingClient.embedTexts(
          texts,
          "RAG_EMBED_BATCH_EMPTY",
          "Batch de chunk embeddings vazio.",
        );
        usedEmbeddingModel = embeddings.model;
        await this.vectorDb.withClient(async (client) => {
          await client.query("begin");
          try {
            for (let index = 0; index < batch.length; index += 1) {
              const chunkId = toInteger(batch[index].chunk_id);
              const vectorLiteral = vectorToLiteral(embeddings.vectors[index]);
              await client.query(
                `
                insert into vector_store.chunk_embeddings (chunk_id, embedding, embedding_model, created_at)
                values ($1, $2::vector, $3, now())
                on conflict (chunk_id)
                do update set
                  embedding = excluded.embedding,
                  embedding_model = excluded.embedding_model,
                  created_at = now()
                `,
                [chunkId, vectorLiteral, embeddings.model],
              );
            }
            await client.query("commit");
          } catch (error) {
            await client.query("rollback");
            throw error;
          }
        });
        embeddedChunks += batch.length;
      } catch (error) {
        failedChunks += batch.length;
        const message = error instanceof Error ? error.message : "Erro desconhecido no batch de embeddings.";
        logger.error("RAG_EMBED_BATCH_FAILED", {
          documentId,
          batchStart: cursor,
          batchSize: batch.length,
          message,
        });
      }
    }

    const skippedChunks = totalChunks - pending.length;
    const status: DocumentChunkEmbeddingResult["status"] =
      failedChunks === 0 ? "completed" : embeddedChunks > 0 ? "partial" : "failed";
    await this.markDocumentEmbeddingStatus(documentId, status === "completed" ? "completed" : "failed", {
      embedded_chunks: embeddedChunks + skippedChunks,
      pending_chunks: Math.max(0, totalChunks - (embeddedChunks + skippedChunks)),
      failed_chunks: failedChunks,
      embedding_model: usedEmbeddingModel,
    });

    logger.info("RAG_EMBED_INDEX_DONE", {
      documentId,
      totalChunks,
      pendingChunks: pending.length,
      embeddedChunks,
      skippedChunks,
      failedChunks,
      status,
      embeddingModel: usedEmbeddingModel,
    });

    return {
      documentId,
      totalChunks,
      pendingChunks: pending.length,
      embeddedChunks,
      skippedChunks,
      failedChunks,
      embeddingModel: usedEmbeddingModel,
      status,
    };
  }

  async markDocumentEmbeddingStatus(
    documentId: number,
    status: "completed" | "failed",
    extra: Record<string, unknown> = {},
  ) {
    await this.vectorDb.query(
      `
      update vector_store.documents
      set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'embedding_status', $2::text,
        'embedding_indexed_at', now()
      ) || $3::jsonb
      where id = $1
      `,
      [documentId, status, JSON.stringify(extra)],
    );
  }
}

export function createChunkEmbeddingService(rawEnv = process.env) {
  return new ChunkEmbeddingService(createVectorDatabaseClient(rawEnv), createQueryEmbeddingClient(rawEnv));
}
