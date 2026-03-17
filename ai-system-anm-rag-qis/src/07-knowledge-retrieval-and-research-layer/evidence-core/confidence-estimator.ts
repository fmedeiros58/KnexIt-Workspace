export function estimateEvidenceConfidence(input: {
  sourceCount: number;
  contradictionCount: number;
  avgTrust: number;
  avgRelevance: number;
}): number {
  const sourceBoost = Math.min(0.3, input.sourceCount * 0.06);
  const contradictionPenalty = Math.min(0.4, input.contradictionCount * 0.15);
  const trust = Math.min(1, Math.max(0, input.avgTrust));
  const relevance = Math.min(1, Math.max(0, input.avgRelevance));
  const score = 0.45 + sourceBoost + trust * 0.25 + relevance * 0.2 - contradictionPenalty;
  return Number(Math.max(0, Math.min(1, score)).toFixed(4));
}
