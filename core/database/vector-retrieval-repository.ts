import { createVectorDatabaseClient, type VectorDatabaseClient } from "./vector-client";
import { resolveVectorSearchParams, type VectorSearchParamsInput } from "./vector-search-params";

type JsonObject = Record<string, unknown>;

export type VectorTopKQuery = VectorSearchParamsInput & {
  queryVector: number[];
  documentId?: number;
  documentIds?: number[];
  sourceType?: string;
  embeddingModel?: string;
};

export type LexicalTopKQuery = {
  queryText: string;
  topK?: number;
  documentId?: number;
  documentIds?: number[];
  sourceType?: string;
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
  lexicalRank?: number | null;
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
  lexical_rank?: string | number | null;
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

function normalizePositiveIntList(values: unknown[], maxItems = 64) {
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
    const { queryVector, documentId, documentIds, sourceType, embeddingModel } = params;
    validateQueryVector(queryVector, this.vectorDb.embeddingDimension);

    const resolved = resolveVectorSearchParams({ topK: params.topK, maxDistance: params.maxDistance });
    const values: Array<string | number | number[]> = [vectorToLiteral(queryVector), resolved.topK];
    const filters: string[] = [`d.status = '${DEFAULT_DOCUMENT_STATUS}'`];

    const scopeDocIds = normalizePositiveIntList([
      ...(Array.isArray(documentIds) ? documentIds : []),
      documentId,
    ]);
    if (scopeDocIds.length === 1) {
      values.push(scopeDocIds[0]);
      filters.push(`d.id = $${values.length}`);
    } else if (scopeDocIds.length > 1) {
      values.push(scopeDocIds);
      filters.push(`d.id = ANY($${values.length}::int[])`);
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
        lexicalRank: row.lexical_rank === null || row.lexical_rank === undefined ? null : toNumber(row.lexical_rank, 0),
      };
    });
  }

  async searchLexicalTopK(params: LexicalTopKQuery): Promise<VectorTopKResult[]> {
    const queryText = `${params.queryText || ""}`.trim();
    if (!queryText) return [];
    const topK = Math.max(1, Math.min(200, Math.trunc(params.topK || 20)));

    const values: Array<string | number | number[]> = [queryText, topK];
    const filters: string[] = [
      `d.status = '${DEFAULT_DOCUMENT_STATUS}'`,
      `to_tsvector('simple', dc.text) @@ websearch_to_tsquery('simple', $1)`,
    ];

    const scopeDocIds = normalizePositiveIntList([
      ...(Array.isArray(params.documentIds) ? params.documentIds : []),
      params.documentId,
    ]);
    if (scopeDocIds.length === 1) {
      values.push(scopeDocIds[0]);
      filters.push(`d.id = $${values.length}`);
    } else if (scopeDocIds.length > 1) {
      values.push(scopeDocIds);
      filters.push(`d.id = ANY($${values.length}::int[])`);
    }

    if (typeof params.sourceType === "string" && params.sourceType.trim()) {
      values.push(params.sourceType.trim());
      filters.push(`d.source_type = $${values.length}`);
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
        (1 - ts_rank_cd(to_tsvector('simple', dc.text), websearch_to_tsquery('simple', $1))) as distance,
        ts_rank_cd(to_tsvector('simple', dc.text), websearch_to_tsquery('simple', $1)) as lexical_rank,
        'lexical'::text as embedding_model,
        d.source_type,
        d.source_path,
        d.title,
        d.metadata
      from vector_store.document_chunks dc
      inner join vector_store.documents d
        on d.id = dc.document_id
      ${whereClause}
      order by lexical_rank desc, dc.id asc
      limit $2
    `;
    const { rows } = await this.vectorDb.query<VectorTopKRow>(sql, values);
    return rows.map((row) => {
      const lexicalRank = row.lexical_rank === null || row.lexical_rank === undefined ? 0 : toNumber(row.lexical_rank, 0);
      const distance = toNumber(row.distance, 1);
      return {
        chunkId: toInteger(row.chunk_id),
        documentId: toInteger(row.document_id),
        chunkIndex: toInteger(row.chunk_index),
        text: row.chunk_text,
        tokenCount: row.token_count === null ? null : toInteger(row.token_count),
        charStart: toInteger(row.char_start),
        charEnd: toInteger(row.char_end),
        distance,
        score: lexicalRank,
        embeddingModel: row.embedding_model,
        sourceType: row.source_type,
        sourcePath: row.source_path,
        title: row.title,
        metadata: normalizeMetadata(row.metadata),
        lexicalRank,
      };
    });
  }
}

export function createVectorRetrievalRepository() {
  return new VectorRetrievalRepository(createVectorDatabaseClient());
}
