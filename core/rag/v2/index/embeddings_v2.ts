import { createVectorDatabaseClient, type VectorDatabaseClient } from "@/core/database/vector-client";
import { createQueryEmbeddingClient, type QueryEmbeddingClient } from "@/core/rag/embedding-client";
import type { ChunkV2 } from "@/core/rag/v2/index/chunker_v2";

function vectorLiteral(vector: number[]) {
  return `[${vector.join(",")}]`;
}

export type EmbeddingIndexInputV2 = {
  docId: number;
  chunks: ChunkV2[];
  embeddingVersion: string;
};

export class EmbeddingsIndexerV2 {
  constructor(
    private readonly vectorDb: VectorDatabaseClient = createVectorDatabaseClient(),
    private readonly embeddingClient: QueryEmbeddingClient = createQueryEmbeddingClient(),
  ) {}

  async index(input: EmbeddingIndexInputV2) {
    const pending = input.chunks.filter((row) => row.text.trim().length > 0);
    if (!pending.length) return { indexed: 0, skipped: 0, embeddingModel: this.embeddingClient.getConfig().model };

    const embeddings = await this.embeddingClient.embedTexts(
      pending.map((row) => row.text),
      "RAG_V2_EMBED_INPUT_EMPTY",
      "Sem chunks para embedding no pipeline v2.",
    );

    await this.vectorDb.withClient(async (client) => {
      await client.query("begin");
      try {
        for (let idx = 0; idx < pending.length; idx += 1) {
          const chunk = pending[idx];
          await client.query(
            `
            insert into rag_v2.embeddings (
              chunk_id, embedding, embedding_model, embedding_version, created_at
            )
            values (
              (select id from rag_v2.chunks where doc_id = $1 and chunk_index = $2 and pipeline_version = 'v2' limit 1),
              $3::vector,
              $4,
              $5,
              now()
            )
            on conflict (chunk_id, embedding_version)
            do update set
              embedding = excluded.embedding,
              embedding_model = excluded.embedding_model,
              created_at = now()
            `,
            [input.docId, chunk.chunkIndex, vectorLiteral(embeddings.vectors[idx]), embeddings.model, input.embeddingVersion],
          );
        }
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    });

    return {
      indexed: pending.length,
      skipped: Math.max(0, input.chunks.length - pending.length),
      embeddingModel: embeddings.model,
    };
  }
}
