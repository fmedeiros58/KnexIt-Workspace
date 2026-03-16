export interface InferentialConfidenceScorerInput {
  implicationCount: number;
  scenarioCount: number;
  secondOrderCount: number;
  uncertainty: number;
}

export interface InferentialConfidenceScorerOutput {
  confidence: number;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function inferentialConfidenceScorer(input: InferentialConfidenceScorerInput): InferentialConfidenceScorerOutput {
  const base = (input.implicationCount * 0.08) + (input.scenarioCount * 0.07) + (input.secondOrderCount * 0.05);
  const penalty = Math.max(0, Math.min(1, input.uncertainty)) * 0.35;
  const confidence = Math.max(0.08, Math.min(0.98, base - penalty + 0.35));

  return {
    confidence: Number(confidence.toFixed(4)),
    ok: true,
    component: "inferential-confidence-scorer",
    score: Number(confidence.toFixed(4)),
    detail: `confidence=${confidence.toFixed(4)}`,
    context: {
      implicationCount: input.implicationCount,
      scenarioCount: input.scenarioCount,
      secondOrderCount: input.secondOrderCount,
      uncertainty: input.uncertainty,
    },
  };
}
