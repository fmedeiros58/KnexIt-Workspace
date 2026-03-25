import type { KnowledgeCandidate } from "../knowledge-types";

export function rerankCandidates(candidates: KnowledgeCandidate[]): KnowledgeCandidate[] {
  return [...candidates]
    .sort((a, b) => {
      const scoreA = a.relevanceScore * 0.55 + a.trustScore * 0.25 + a.freshnessScore * 0.2;
      const scoreB = b.relevanceScore * 0.55 + b.trustScore * 0.25 + b.freshnessScore * 0.2;
      return scoreB - scoreA;
    });
}
