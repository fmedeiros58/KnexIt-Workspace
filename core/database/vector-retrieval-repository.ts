import { createVectorDatabaseClient, type VectorDatabaseClient } from "./vector-client";
import { resolveVectorSearchParams, type VectorSearchParamsInput } from "./vector-search-params";

type JsonObject = Record<string, unknown>;

export type VectorTopKQuery = VectorSearchParamsInput & {
  queryVector: number[];
  documentId?: number;
  sourceType?: string;
  embeddingModel?: string;
};

export type VectorTopKResult = {
  chunkId: number;
  documentId: number;
  chunkIndex: number;
  text: string;
  tokenCount: number | null;
  charStart: number;
  charEnd: number;
  distance: number;
  score: number;
  embeddingModel: string;
  sourceType: string;
  sourcePath: string;
  title: string | null;
  metadata: JsonObject;
};

type VectorTopKRow = {
  chunk_id: string | number;
  document_id: string | number;
  chunk_index: string | number;
  chunk_text: string;
  token_count: string | number | null;
  char_start: string | number;
  char_end: string | number;
  distance: string | number;
  embedding_model: string;
  source_type: string;
  source_path: string;
  title: string | null;
  metadata: JsonObject | null;
};

const DEFAULT_DOCUMENT_STATUS = "processed";

function toInteger(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeMetadata(value: JsonObject | null | undefined): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function vectorToLiteral(vector: number[]) {
  return `[${vector.join(",")}]`;
}

function validateQueryVector(vector: number[], expectedDimension: number) {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("queryVector vazio. Envie um vetor com dimensao valida.");
  }
  if (vector.length !== expectedDimension) {
    throw new Error(`queryVector com dimensao invalida: recebido=${vector.length} esperado=${expectedDimension}.`);
  }
  for (const value of vector) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error("queryVector contem valores invalidos (somente numeros finitos sao aceitos).");
    }
  }
}

function mapScoreFromCosineDistance(distance: number) {
  // Para cosine distance no pgvector, menor e melhor. O score e normalizado para leitura.
  return 1 - distance;
}

export class VectorRetrievalRepository {
  constructor(private readonly vectorDb: VectorDatabaseClient = createVectorDatabaseClient()) {}

  async searchTopK(params: VectorTopKQuery): Promise<VectorTopKResult[]> {
    const { queryVector, documentId, sourceType, embeddingModel } = params;
    validateQueryVector(queryVector, this.vectorDb.embeddingDimension);

    const resolved = resolveVectorSearchParams({ topK: params.topK, maxDistance: params.maxDistance });
    const values: Array<string | number> = [vectorToLiteral(queryVector), resolved.topK];
    const filters: string[] = [`d.status = '${DEFAULT_DOCUMENT_STATUS}'`];

    if (typeof documentId === "number" && Number.isFinite(documentId)) {
      values.push(Math.trunc(documentId));
      filters.push(`d.id = $${values.length}`);
    }

    if (typeof sourceType === "string" && sourceType.trim()) {
      values.push(sourceType.trim());
      filters.push(`d.source_type = $${values.length}`);
    }

    if (typeof embeddingModel === "string" && embeddingModel.trim()) {
      values.push(embeddingModel.trim());
      filters.push(`ce.embedding_model = $${values.length}`);
    }

    if (typeof resolved.maxDistance === "number" && Number.isFinite(resolved.maxDistance)) {
      values.push(resolved.maxDistance);
      filters.push(`(ce.embedding <=> $1::vector) <= $${values.length}`);
    }

    const whereClause = filters.length ? `where ${filters.join(" and ")}` : "";
    const sql = `
      select
        dc.id as chunk_id,
        dc.document_id,
        dc.chunk_index,
        dc.text as chunk_text,
        dc.token_count,
        dc.char_start,
        dc.char_end,
        (ce.embedding <=> $1::vector) as distance,
        ce.embedding_model,
        d.source_type,
        d.source_path,
        d.title,
        d.metadata
      from vector_store.chunk_embeddings ce
      inner join vector_store.document_chunks dc
        on dc.id = ce.chunk_id
      inner join vector_store.documents d
        on d.id = dc.document_id
      ${whereClause}
      order by ce.embedding <=> $1::vector
      limit $2
    `;

    const { rows } = await this.vectorDb.query<VectorTopKRow>(sql, values);

    return rows.map((row) => {
      const distance = toNumber(row.distance, Number.POSITIVE_INFINITY);
      return {
        chunkId: toInteger(row.chunk_id),
        documentId: toInteger(row.document_id),
        chunkIndex: toInteger(row.chunk_index),
        text: row.chunk_text,
        tokenCount: row.token_count === null ? null : toInteger(row.token_count),
        charStart: toInteger(row.char_start),
        charEnd: toInteger(row.char_end),
        distance,
        score: mapScoreFromCosineDistance(distance),
        embeddingModel: row.embedding_model,
        sourceType: row.source_type,
        sourcePath: row.source_path,
        title: row.title,
        metadata: normalizeMetadata(row.metadata),
      };
    });
  }
}

export function createVectorRetrievalRepository() {
  return new VectorRetrievalRepository(createVectorDatabaseClient());
}
