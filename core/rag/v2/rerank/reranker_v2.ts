import type { HybridHit } from "@/core/rag/v2/retrieval/hybrid_v2";

export type RerankInput = {
  queryText: string;
  hits: HybridHit[];
  maxCandidates?: number;
  returnTop?: number;
};

export type RerankResult = {
  hits: HybridHit[];
  applied: boolean;
  beforeOrderChunkIds: number[];
  afterOrderChunkIds: number[];
};

function normalizeText(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 2);
}

function overlapScore(queryTokens: string[], chunkText: string) {
  if (!queryTokens.length) return 0;
  const chunkTokens = new Set(tokenize(chunkText));
  if (!chunkTokens.size) return 0;
  let overlap = 0;
  for (const token of queryTokens) {
    if (chunkTokens.has(token)) overlap += 1;
  }
  return overlap / queryTokens.length;
}

function phraseBonus(queryText: string, chunkText: string) {
  const query = normalizeText(queryText);
  const chunk = normalizeText(chunkText);
  if (!query || !chunk) return 0;
  if (chunk.includes(query)) return 0.25;
  return 0;
}

function shouldApplyRerank(queryText: string, hits: HybridHit[]) {
  if (hits.length <= 2) return false;
  const queryWordCount = tokenize(queryText).length;
  if (queryWordCount >= 10) return true;
  const topScore = hits[0]?.hybridScore || 0;
  const secondScore = hits[1]?.hybridScore || 0;
  return Math.abs(topScore - secondScore) < 0.08;
}

export class RerankerV2 {
  rerank(input: RerankInput): RerankResult {
    const queryText = `${input.queryText || ""}`.trim();
    const maxCandidates = Math.max(1, Math.min(120, Math.trunc(input.maxCandidates || 40)));
    const returnTop = Math.max(1, Math.min(60, Math.trunc(input.returnTop || 12)));
    const candidates = [...(input.hits || [])].slice(0, maxCandidates);
    if (!queryText || !candidates.length || !shouldApplyRerank(queryText, candidates)) {
      return {
        hits: candidates.slice(0, returnTop),
        applied: false,
        beforeOrderChunkIds: candidates.map((row) => row.chunkId),
        afterOrderChunkIds: candidates.slice(0, returnTop).map((row) => row.chunkId),
      };
    }

    const queryTokens = tokenize(queryText);
    const beforeOrderChunkIds = candidates.map((row) => row.chunkId);
    const rescored = candidates
      .map((row) => {
        const lexicalAlignment = overlapScore(queryTokens, row.text);
        const sectionBonus = row.title && normalizeText(row.title).includes(queryTokens[0] || "") ? 0.05 : 0;
        const rerankScore = row.hybridScore * 0.60 + lexicalAlignment * 0.30 + phraseBonus(queryText, row.text) * 0.08 + sectionBonus;
        return {
          ...row,
          hybridScore: rerankScore,
        };
      })
      .sort((a, b) => {
        if (b.hybridScore !== a.hybridScore) return b.hybridScore - a.hybridScore;
        return a.chunkId - b.chunkId;
      });

    const selected = rescored.slice(0, returnTop);
    return {
      hits: selected,
      applied: true,
      beforeOrderChunkIds,
      afterOrderChunkIds: selected.map((row) => row.chunkId),
    };
  }
}
