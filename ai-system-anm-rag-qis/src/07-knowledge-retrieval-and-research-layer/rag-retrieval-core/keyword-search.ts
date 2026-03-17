import type { KnowledgeCandidate } from "../knowledge-types";

function countHits(query: string, text: string) {
  const terms = query.toLowerCase().split(/\W+/g).filter((item) => item.length > 2);
  const hay = text.toLowerCase();
  return terms.reduce((sum, term) => sum + (hay.includes(term) ? 1 : 0), 0);
}

export function runKeywordSearch(query: string, candidates: KnowledgeCandidate[], topK = 8): KnowledgeCandidate[] {
  return [...candidates]
    .map((item) => ({ ...item, relevanceScore: Math.max(item.relevanceScore, countHits(query, item.snippet) / 8) }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, topK);
}
