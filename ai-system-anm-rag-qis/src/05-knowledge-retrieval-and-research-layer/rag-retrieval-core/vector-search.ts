import type { KnowledgeCandidate } from "../knowledge-types";

function charOverlapScore(a: string, b: string) {
  const setA = new Set(a.toLowerCase().split(""));
  const setB = new Set(b.toLowerCase().split(""));
  let overlap = 0;
  for (const ch of setA) if (setB.has(ch)) overlap += 1;
  return overlap / Math.max(1, setA.size);
}

export function runVectorSearch(query: string, candidates: KnowledgeCandidate[], topK = 8): KnowledgeCandidate[] {
  return [...candidates]
    .map((item) => ({ ...item, relevanceScore: Math.max(item.relevanceScore, charOverlapScore(query, item.snippet)) }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, topK);
}
