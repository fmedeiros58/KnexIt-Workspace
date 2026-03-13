import type { KnowledgeCandidate } from "../knowledge-types";

function hitScore(query: string, text: string) {
  const terms = query.toLowerCase().split(/\W+/g).filter((item) => item.length > 2);
  const hay = text.toLowerCase();
  const hits = terms.filter((term) => hay.includes(term)).length;
  return hits / Math.max(1, terms.length);
}

export function alignEvidenceToQuery(query: string, candidates: KnowledgeCandidate[]): KnowledgeCandidate[] {
  return candidates
    .map((item) => ({ ...item, relevanceScore: Math.max(item.relevanceScore, hitScore(query, item.snippet)) }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}
