export function detectHallucinationRisk(input: { uncertainty: number; sourceCount: number; hypothesisCount: number }): {
  risk: number;
  issues: string[];
} {
  const issues: string[] = [];
  const uncertainty = Number.isFinite(input.uncertainty) ? Math.min(1, Math.max(0, input.uncertainty)) : 1;
  let risk = uncertainty * 0.55;
  if (input.sourceCount === 0) {
    risk += 0.35;
    issues.push("no_sources");
  }
  if (input.hypothesisCount < 2) {
    risk += 0.15;
    issues.push("low_hypothesis_diversity");
  }
  return { risk: Number(Math.min(1, risk).toFixed(4)), issues };
}
