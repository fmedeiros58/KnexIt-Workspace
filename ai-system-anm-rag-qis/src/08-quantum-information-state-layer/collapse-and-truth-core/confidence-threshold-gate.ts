export function applyConfidenceThreshold(score: number): number {
  if (!Number.isFinite(score)) return 0;
  if (score <= 0.05) return 0;
  if (score >= 0.95) return 1;
  return Number(score.toFixed(4));
}
