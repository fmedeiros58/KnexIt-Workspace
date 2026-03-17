export function validateHypothesisTrace(input: { dominantHypothesisId: string | null; hypothesisIds: string[] }): {
  ok: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  if (!input.dominantHypothesisId) issues.push("missing_dominant_hypothesis");
  if (input.dominantHypothesisId && !input.hypothesisIds.includes(input.dominantHypothesisId)) {
    issues.push("dominant_hypothesis_not_in_set");
  }
  return { ok: issues.length === 0, issues };
}
