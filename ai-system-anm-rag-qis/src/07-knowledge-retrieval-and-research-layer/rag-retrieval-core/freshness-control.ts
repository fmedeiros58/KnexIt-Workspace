import type { KnowledgeCandidate } from "../knowledge-types";

export function applyFreshnessControl(candidates: KnowledgeCandidate[], minFreshness = 0.15): KnowledgeCandidate[] {
  const filtered = candidates.filter((item) => item.freshnessScore >= minFreshness);
  return filtered.length ? filtered : candidates;
}
