export function decideAcceptOrRetry(scores: {
  coherence: number;
  density: number;
  epistemic: number;
  fluency: number;
  relevance: number;
}): { score: number; decision: "accept" | "retry" } {
  const score = Number((
    scores.coherence * 0.24
    + scores.density * 0.12
    + scores.epistemic * 0.34
    + scores.fluency * 0.14
    + scores.relevance * 0.16
  ).toFixed(4));

  return {
    score,
    decision: score >= 0.62 ? "accept" : "retry",
  };
}
