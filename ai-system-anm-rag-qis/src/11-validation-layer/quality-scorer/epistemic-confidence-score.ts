export function scoreEpistemicConfidence(input: { uncertainty: number; sourceCount: number; risk: number }): number {
  const sourceBoost = Math.min(0.35, input.sourceCount * 0.08);
  const uncertaintyPenalty = Math.min(0.5, Math.max(0, input.uncertainty) * 0.55);
  const riskPenalty = Math.min(0.45, Math.max(0, input.risk) * 0.65);
  const score = 0.65 + sourceBoost - uncertaintyPenalty - riskPenalty;
  return Number(Math.min(1, Math.max(0, score)).toFixed(4));
}
