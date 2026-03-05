import {
  createVectorRetrievalRepository,
  type VectorRetrievalRepository,
  type VectorTopKResult,
} from "@/core/database/vector-retrieval-repository";

export type HybridRetrievalInput = {
  queryText: string;
  queryVector: number[] | null;
  topK: number;
  topKVector?: number;
  topKLexical?: number;
  maxDistance?: number | null;
  documentId?: number;
  documentIds?: number[];
  priorityDocumentIds?: number[];
  priorityBoost?: number;
  sourceType?: string;
  embeddingModel?: string;
  weightVector?: number;
  weightLexical?: number;
  weightStruct?: number;
  mmrEnabled?: boolean;
  mmrLambda?: number;
  cacheEnabled?: boolean;
  allowScopeFallback?: boolean;
};

export type HybridHit = VectorTopKResult & {
  vectorScore: number;
  lexicalScore: number;
  structBoost: number;
  hybridScore: number;
  rankSource: "vector" | "lexical" | "mixed" | "scope_fallback";
};

export type HybridRetrievalResult = {
  hits: HybridHit[];
  vectorCount: number;
  lexicalCount: number;
  usedScopeFallback: boolean;
  usedCache: boolean;
};

const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ITEMS = 256;
const CACHE =
  (globalThis as { __ragV2HybridCache?: Map<string, { expiresAt: number; result: HybridRetrievalResult }> }).__ragV2HybridCache ??
  new Map<string, { expiresAt: number; result: HybridRetrievalResult }>();
(globalThis as { __ragV2HybridCache?: Map<string, { expiresAt: number; result: HybridRetrievalResult }> }).__ragV2HybridCache =
  CACHE;

function normalizeText(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 2);
}

function jaccard(a: string, b: string) {
  const aSet = new Set(tokenize(a));
  const bSet = new Set(tokenize(b));
  if (!aSet.size || !bSet.size) return 0;
  let intersect = 0;
  for (const token of aSet) {
    if (bSet.has(token)) intersect += 1;
  }
  const union = aSet.size + bSet.size - intersect;
  return union > 0 ? intersect / union : 0;
}

function normalizedVectorScore(distance: number) {
  if (!Number.isFinite(distance)) return 0;
  return clamp(1 - distance, 0, 1);
}

function normalizedLexicalScore(rank: number, maxRank: number) {
  if (!Number.isFinite(rank) || rank <= 0) return 0;
  const denominator = maxRank > 0 ? maxRank : 1;
  return clamp(rank / denominator, 0, 1);
}

function computeStructBoost(hit: VectorTopKResult, queryText: string) {
  const queryTokens = tokenize(queryText);
  if (!queryTokens.length) return 0;
  const title = normalizeText(hit.title || "");
  if (!title) return 0;
  let overlap = 0;
  for (const token of queryTokens) {
    if (title.includes(token)) overlap += 1;
  }
  return clamp(overlap / Math.max(queryTokens.length, 1), 0, 1);
}

function mmrDiversify(hits: HybridHit[], topK: number, lambdaValue: number) {
  if (!hits.length) return [];
  const lambda = clamp(lambdaValue, 0.05, 0.95);
  const selected: HybridHit[] = [];
  const remaining = [...hits];
  while (remaining.length && selected.length < topK) {
    if (!selected.length) {
      selected.push(remaining.shift() as HybridHit);
      continue;
    }
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let idx = 0; idx < remaining.length; idx += 1) {
      const candidate = remaining[idx];
      let maxSimilarity = 0;
      for (const picked of selected) {
        maxSimilarity = Math.max(maxSimilarity, jaccard(candidate.text, picked.text));
      }
      const mmrScore = lambda * candidate.hybridScore - (1 - lambda) * maxSimilarity;
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIndex = idx;
      }
    }
    selected.push(remaining.splice(bestIndex, 1)[0]);
  }
  return selected;
}

function makeCacheKey(input: HybridRetrievalInput) {
  const docScope = Array.isArray(input.documentIds) ? input.documentIds.join(",") : "";
  const priorityScope = Array.isArray(input.priorityDocumentIds) ? input.priorityDocumentIds.join(",") : "";
  return [
    normalizeText(input.queryText),
    input.topK,
    input.topKVector || "",
    input.topKLexical || "",
    input.maxDistance ?? "",
    input.documentId ?? "",
    docScope,
    priorityScope,
    input.priorityBoost ?? "",
    input.sourceType || "",
    input.embeddingModel || "",
    input.weightVector ?? "",
    input.weightLexical ?? "",
    input.weightStruct ?? "",
    input.mmrEnabled ? "1" : "0",
    input.mmrLambda ?? "",
    input.allowScopeFallback === false ? "no_scope_fallback" : "scope_fallback_ok",
  ].join("|");
}

function trimCache() {
  const now = Date.now();
  for (const [key, row] of CACHE.entries()) {
    if (row.expiresAt <= now) CACHE.delete(key);
  }
  if (CACHE.size <= MAX_CACHE_ITEMS) return;
  const keys = Array.from(CACHE.keys());
  while (CACHE.size > MAX_CACHE_ITEMS && keys.length) {
    const key = keys.shift();
    if (!key) break;
    CACHE.delete(key);
  }
}

export class HybridRetrieverV2 {
  constructor(private readonly repository: VectorRetrievalRepository = createVectorRetrievalRepository()) {}

  async search(input: HybridRetrievalInput): Promise<HybridRetrievalResult> {
    const safeTopK = Math.max(1, Math.min(100, Math.trunc(input.topK || 12)));
    const cacheEnabled = input.cacheEnabled !== false;
    const cacheKey = makeCacheKey(input);
    if (cacheEnabled) {
      trimCache();
      const cached = CACHE.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return { ...cached.result, usedCache: true };
      }
    }

    const topKVector = Math.max(safeTopK, Math.min(200, Math.trunc(input.topKVector || safeTopK * 3)));
    const topKLexical = Math.max(safeTopK, Math.min(200, Math.trunc(input.topKLexical || safeTopK * 3)));
    const weightVector = clamp(Number.isFinite(input.weightVector as number) ? Number(input.weightVector) : 0.60, 0, 1);
    const weightLexical = clamp(Number.isFinite(input.weightLexical as number) ? Number(input.weightLexical) : 0.30, 0, 1);
    const weightStruct = clamp(Number.isFinite(input.weightStruct as number) ? Number(input.weightStruct) : 0.10, 0, 1);
    const priorityBoost = clamp(Number.isFinite(input.priorityBoost as number) ? Number(input.priorityBoost) : 0.18, 0, 0.6);
    const priorityDocumentIds = Array.isArray(input.priorityDocumentIds)
      ? input.priorityDocumentIds
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0)
          .map((value) => Math.trunc(value))
          .slice(0, 64)
      : [];
    const prioritySet = new Set<number>(priorityDocumentIds);

    const [vectorHits, lexicalHits] = await Promise.all([
      input.queryVector && input.queryVector.length
        ? this.repository.searchTopK({
            queryVector: input.queryVector,
            topK: topKVector,
            maxDistance: input.maxDistance,
            documentId: input.documentId,
            documentIds: input.documentIds,
            sourceType: input.sourceType,
            embeddingModel: input.embeddingModel,
          })
        : Promise.resolve([]),
      this.repository.searchLexicalTopK({
        queryText: input.queryText,
        topK: topKLexical,
        documentId: input.documentId,
        documentIds: input.documentIds,
        sourceType: input.sourceType,
      }),
    ]);

    const maxLexicalRank = lexicalHits.reduce((max, row) => Math.max(max, Number(row.lexicalRank || row.score || 0)), 0);
    const byChunk = new Map<number, HybridHit>();
    let usedScopeFallback = false;

    for (const row of vectorHits) {
      const vectorScore = normalizedVectorScore(row.distance);
      const structBoost = computeStructBoost(row, input.queryText);
      const lexicalScore = 0;
      const hybridScore = weightVector * vectorScore + weightLexical * lexicalScore + weightStruct * structBoost;
      byChunk.set(row.chunkId, {
        ...row,
        vectorScore,
        lexicalScore,
        structBoost,
        hybridScore,
        rankSource: "vector",
      });
    }

    for (const row of lexicalHits) {
      const lexicalScore = normalizedLexicalScore(Number(row.lexicalRank || row.score || 0), maxLexicalRank);
      const structBoost = computeStructBoost(row, input.queryText);
      const vectorScore = byChunk.get(row.chunkId)?.vectorScore || 0;
      const hybridScore = weightVector * vectorScore + weightLexical * lexicalScore + weightStruct * structBoost;
      const existing = byChunk.get(row.chunkId);
      byChunk.set(row.chunkId, {
        ...(existing || row),
        vectorScore,
        lexicalScore,
        structBoost,
        hybridScore,
        rankSource: existing ? "mixed" : "lexical",
      });
    }

    if (prioritySet.size > 0) {
      for (const row of byChunk.values()) {
        if (!prioritySet.has(row.documentId)) continue;
        row.hybridScore = clamp(row.hybridScore + priorityBoost, 0, 2);
      }
    }

    const ranked = Array.from(byChunk.values()).sort((a, b) => {
      if (b.hybridScore !== a.hybridScore) return b.hybridScore - a.hybridScore;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return a.chunkId - b.chunkId;
    });
    let finalHits = input.mmrEnabled ? mmrDiversify(ranked, safeTopK, Number(input.mmrLambda || 0.75)) : ranked.slice(0, safeTopK);
    const hasDocumentScope = Boolean(input.documentId) || (Array.isArray(input.documentIds) && input.documentIds.length > 0);
    const allowScopeFallback = input.allowScopeFallback !== false;
    if (finalHits.length === 0 && hasDocumentScope && allowScopeFallback) {
      const scopedFallback = await this.repository.searchScopedChunksFallback({
        topK: safeTopK,
        documentId: input.documentId,
        documentIds: input.documentIds,
        sourceType: input.sourceType,
      });
      if (scopedFallback.length > 0) {
        usedScopeFallback = true;
        finalHits = scopedFallback.map((row) => {
          const structBoost = computeStructBoost(row, input.queryText);
          const baseScore = clamp(0.20 + structBoost * 0.20, 0, 1);
          return {
            ...row,
            vectorScore: 0,
            lexicalScore: 0,
            structBoost,
            hybridScore: baseScore,
            rankSource: "scope_fallback",
          };
        });
      }
    }
    const result: HybridRetrievalResult = {
      hits: finalHits,
      vectorCount: vectorHits.length,
      lexicalCount: lexicalHits.length,
      usedScopeFallback,
      usedCache: false,
    };
    if (cacheEnabled) {
      CACHE.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
    }
    return result;
  }
}
