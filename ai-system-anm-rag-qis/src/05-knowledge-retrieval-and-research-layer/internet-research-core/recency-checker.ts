export function evaluateRecency(input: { freshnessScore?: number; updatedAt?: string }): number {
  if (typeof input.freshnessScore === "number" && Number.isFinite(input.freshnessScore)) {
    return Math.max(0, Math.min(1, input.freshnessScore));
  }
  if (!input.updatedAt) return 0.4;
  const updated = Date.parse(input.updatedAt);
  if (!Number.isFinite(updated)) return 0.4;
  const days = (Date.now() - updated) / (1000 * 60 * 60 * 24);
  if (days <= 2) return 0.92;
  if (days <= 7) return 0.82;
  if (days <= 30) return 0.68;
  if (days <= 180) return 0.54;
  return 0.35;
}
