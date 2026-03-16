function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function evaluateRecency(input: { freshnessScore?: number; updatedAt?: string; snippet?: string }): number {
  if (typeof input.freshnessScore === "number" && Number.isFinite(input.freshnessScore)) {
    return clamp01(input.freshnessScore);
  }

  const snippet = `${input.snippet || ""}`;
  const yearMatch = snippet.match(/\b(20\d{2})\b/);
  if (yearMatch?.[1]) {
    const year = Number(yearMatch[1]);
    const currentYear = new Date().getUTCFullYear();
    const diff = Math.max(0, currentYear - year);
    if (diff <= 1) return 0.88;
    if (diff <= 2) return 0.78;
    if (diff <= 4) return 0.66;
    return 0.48;
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
