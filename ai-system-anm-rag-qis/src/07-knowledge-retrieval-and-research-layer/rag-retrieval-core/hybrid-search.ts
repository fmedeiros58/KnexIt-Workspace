import type { KnowledgeCandidate } from "../knowledge-types";
import { runKeywordSearch } from "./keyword-search";
import { runVectorSearch } from "./vector-search";

export function runHybridSearch(query: string, candidates: KnowledgeCandidate[], topK = 8): KnowledgeCandidate[] {
  const keyword = runKeywordSearch(query, candidates, topK * 2);
  const vector = runVectorSearch(query, candidates, topK * 2);
  const byUrl = new Map<string, KnowledgeCandidate>();

  for (const item of [...keyword, ...vector]) {
    const existing = byUrl.get(item.url);
    if (!existing) byUrl.set(item.url, item);
    else {
      byUrl.set(item.url, {
        ...item,
        relevanceScore: Math.max(existing.relevanceScore, item.relevanceScore),
        trustScore: Math.max(existing.trustScore, item.trustScore),
        freshnessScore: Math.max(existing.freshnessScore, item.freshnessScore),
      });
    }
  }

  return [...byUrl.values()]
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, topK);
}
