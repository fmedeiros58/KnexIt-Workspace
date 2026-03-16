import type { KnowledgeCandidate } from "../knowledge-types";

export function fuseRetrievalResults(groups: KnowledgeCandidate[][], topK = 8): KnowledgeCandidate[] {
  const byUrl = new Map<string, KnowledgeCandidate>();
  for (const group of groups) {
    for (const item of group) {
      const prev = byUrl.get(item.url);
      if (!prev) byUrl.set(item.url, item);
      else {
        byUrl.set(item.url, {
          ...item,
          relevanceScore: Math.max(prev.relevanceScore, item.relevanceScore),
          trustScore: Math.max(prev.trustScore, item.trustScore),
          freshnessScore: Math.max(prev.freshnessScore, item.freshnessScore),
        });
      }
    }
  }
  return [...byUrl.values()].slice(0, topK);
}
