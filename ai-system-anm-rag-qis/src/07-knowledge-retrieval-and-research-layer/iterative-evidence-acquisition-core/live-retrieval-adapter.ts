/**
 * Responsabilidade do arquivo:
 * - Conectar o iterative core a retrieval vivo do vector_store (lexical e vetorial).
 * - Fornecer fallback seguro quando DB/embeddings estiverem indisponiveis.
 * - Evitar chamadas repetidas com cache operacional de curta duracao.
 */
import { createVectorRetrievalRepository } from "../../../../core/database/vector-retrieval-repository";
import type { VectorTopKResult } from "../../../../core/database/vector-retrieval-repository";
import { QueryEmbeddingClient } from "../../../../core/rag/embedding-client";
import { clampConfidence } from "../../shared/utils/confidence-utils";
import { normalizeWhitespace, truncateText } from "../../shared/utils/text-utils";
import type { FunctionalSourceType } from "./iterative-acquisition-types";

export interface LiveRetrievalHit {
  id: string;
  title: string;
  url: string;
  snippet: string;
  sourceType: FunctionalSourceType;
  provider: string;
  relevanceScore: number;
  trustScore: number;
  freshnessScore: number;
  retrievalScore: number;
  tags: string[];
}

type CacheEntry = {
  expiresAt: number;
  rows: LiveRetrievalHit[];
};

const CACHE_TTL_MS = 45_000;
const CACHE = new Map<string, CacheEntry>();
const vectorRepo = createVectorRetrievalRepository();
let embeddingClient: QueryEmbeddingClient | null = null;

function clamp01(value: number): number {
  return clampConfidence(value);
}

function makeCacheKey(mode: "lexical" | "vector", query: string, topK: number) {
  return `${mode}:${topK}:${normalizeWhitespace(query).toLowerCase()}`;
}

function readCache(key: string): LiveRetrievalHit[] | null {
  const cached = CACHE.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    CACHE.delete(key);
    return null;
  }
  return cached.rows;
}

function writeCache(key: string, rows: LiveRetrievalHit[]): void {
  CACHE.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    rows,
  });
}

function normalizeSnippet(value: string): string {
  return truncateText(normalizeWhitespace(value || ""), 560);
}

function resolveChunkUrl(row: VectorTopKResult): string {
  const sourcePath = `${row.sourcePath || ""}`.trim();
  if (/^https?:\/\//i.test(sourcePath)) return sourcePath;
  return `document://vector_store/document/${row.documentId}/chunk/${row.chunkId}`;
}

function mapLexicalRow(row: VectorTopKResult): LiveRetrievalHit {
  const title = `${row.title || ""}`.trim() || `document-${row.documentId}#chunk-${row.chunkIndex}`;
  const relevance = clamp01(Number(row.lexicalRank ?? row.score ?? 0.5));
  const trustBySource =
    row.sourceType === "official_registry"
      ? 0.82
      : row.sourceType === "identity_registry"
        ? 0.78
        : row.sourceType === "user_upload"
          ? 0.66
          : 0.62;
  return {
    id: `rag:lexical:${row.chunkId}`,
    title,
    url: resolveChunkUrl(row),
    snippet: normalizeSnippet(row.text),
    sourceType: "rag",
    provider: "vector_store_lexical",
    relevanceScore: relevance,
    trustScore: trustBySource,
    freshnessScore: 0.64,
    retrievalScore: clamp01((relevance * 0.62) + (trustBySource * 0.38)),
    tags: ["rag", "vector_store", "lexical"],
  };
}

function mapVectorRow(row: VectorTopKResult): LiveRetrievalHit {
  const title = `${row.title || ""}`.trim() || `document-${row.documentId}#chunk-${row.chunkIndex}`;
  const relevance = clamp01(Number(row.score || 0.5));
  const trustBySource =
    row.sourceType === "official_registry"
      ? 0.84
      : row.sourceType === "identity_registry"
        ? 0.8
        : row.sourceType === "user_upload"
          ? 0.68
          : 0.64;
  return {
    id: `rag:vector:${row.chunkId}`,
    title,
    url: resolveChunkUrl(row),
    snippet: normalizeSnippet(row.text),
    sourceType: "vector",
    provider: "vector_store_pgvector",
    relevanceScore: relevance,
    trustScore: trustBySource,
    freshnessScore: 0.64,
    retrievalScore: clamp01((relevance * 0.65) + (trustBySource * 0.35)),
    tags: ["rag", "vector_store", "pgvector"],
  };
}

function normalizeTopK(topK: number): number {
  return Math.max(1, Math.min(30, Math.trunc(topK || 8)));
}

function ensureEmbeddingClient(): QueryEmbeddingClient {
  if (!embeddingClient) {
    embeddingClient = new QueryEmbeddingClient();
  }
  return embeddingClient;
}

export async function retrieveLiveLexicalEvidence(query: string, topK: number): Promise<LiveRetrievalHit[]> {
  const normalizedQuery = normalizeWhitespace(query || "");
  if (!normalizedQuery) return [];

  const resolvedTopK = normalizeTopK(topK);
  const key = makeCacheKey("lexical", normalizedQuery, resolvedTopK);
  const cached = readCache(key);
  if (cached) return cached;

  try {
    const rows = await vectorRepo.searchLexicalTopK({
      queryText: normalizedQuery,
      topK: resolvedTopK,
    });
    const mapped = rows.map(mapLexicalRow);
    writeCache(key, mapped);
    return mapped;
  } catch {
    return [];
  }
}

export async function retrieveLiveVectorEvidence(query: string, topK: number): Promise<LiveRetrievalHit[]> {
  const normalizedQuery = normalizeWhitespace(query || "");
  if (!normalizedQuery) return [];

  const resolvedTopK = normalizeTopK(topK);
  const key = makeCacheKey("vector", normalizedQuery, resolvedTopK);
  const cached = readCache(key);
  if (cached) return cached;

  try {
    const embed = await ensureEmbeddingClient().embedQuery(normalizedQuery);
    const rows = await vectorRepo.searchTopK({
      queryVector: embed.vector,
      topK: resolvedTopK,
      embeddingModel: embed.model,
    });
    const mapped = rows.map(mapVectorRow);
    if (mapped.length > 0) {
      writeCache(key, mapped);
      return mapped;
    }
  } catch {
    // Fallback lexical abaixo.
  }

  const lexicalFallback = await retrieveLiveLexicalEvidence(normalizedQuery, resolvedTopK);
  const mappedFallback = lexicalFallback.map((item) => ({
    ...item,
    sourceType: "vector" as const,
    provider: "vector_store_lexical_fallback",
    tags: [...item.tags, "fallback"],
  }));
  writeCache(key, mappedFallback);
  return mappedFallback;
}

