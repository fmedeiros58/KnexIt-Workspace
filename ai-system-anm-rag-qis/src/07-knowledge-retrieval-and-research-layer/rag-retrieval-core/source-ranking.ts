import type { KnowledgeCandidate } from "../knowledge-types";

export function rankSourcesByTrustAndFreshness(candidates: KnowledgeCandidate[]): KnowledgeCandidate[] {
  return [...candidates].sort((a, b) => {
    const aScore = a.trustScore * 0.6 + a.freshnessScore * 0.4;
    const bScore = b.trustScore * 0.6 + b.freshnessScore * 0.4;
    return bScore - aScore;
  });
}
