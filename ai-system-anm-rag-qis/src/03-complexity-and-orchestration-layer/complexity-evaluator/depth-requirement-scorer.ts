export interface DepthRequirementScorerInput {
  complexityScore: number;
  ambiguityScore: number;
  intent: string;
}

export interface DepthRequirementScorerOutput {
  depthRequired: number;
  score: number;
  ok: boolean;
  component: string;
  detail: string;
  context: Record<string, unknown>;
}

export function depthRequirementScorer(input: DepthRequirementScorerInput): DepthRequirementScorerOutput {
  const complexity = Math.max(0, Math.min(1, input.complexityScore));
  const ambiguity = Math.max(0, Math.min(1, input.ambiguityScore));

  let depthRequired = 8 + Math.round((complexity * 6) + (ambiguity * 2));
  if (input.intent === "research" || input.intent === "analysis") depthRequired += 1;
  if (input.intent === "summary" || input.intent === "chat") depthRequired -= 1;

  depthRequired = Math.max(6, Math.min(16, depthRequired));
  const score = Math.max(0, Math.min(1, (depthRequired - 6) / 10));

  return {
    depthRequired,
    score: Number(score.toFixed(4)),
    ok: true,
    component: "depth-requirement-scorer",
    detail: `depth=${depthRequired}`,
    context: {
      complexity,
      ambiguity,
      intent: input.intent,
    },
  };
}
