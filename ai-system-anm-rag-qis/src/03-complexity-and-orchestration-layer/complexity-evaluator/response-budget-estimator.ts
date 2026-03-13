export interface ResponseBudgetEstimatorInput {
  complexityScore: number;
  depthRequired: number;
  mode: string;
}

export interface ResponseBudgetEstimatorOutput {
  responseBudget: number;
  score: number;
  ok: boolean;
  component: string;
  detail: string;
  context: Record<string, unknown>;
}

export function responseBudgetEstimator(input: ResponseBudgetEstimatorInput): ResponseBudgetEstimatorOutput {
  const complexity = Math.max(0, Math.min(1, input.complexityScore));
  const depthFactor = Math.max(0, Math.min(1, input.depthRequired / 16));

  let responseBudget = 320 + Math.round((complexity * 780) + (depthFactor * 380));
  if (input.mode === "summary") responseBudget = Math.round(responseBudget * 0.72);
  if (input.mode === "research" || input.mode === "technical") responseBudget = Math.round(responseBudget * 1.12);

  responseBudget = Math.max(220, Math.min(1800, responseBudget));
  const score = Math.max(0, Math.min(1, responseBudget / 1800));

  return {
    responseBudget,
    score: Number(score.toFixed(4)),
    ok: true,
    component: "response-budget-estimator",
    detail: `budget=${responseBudget}`,
    context: {
      complexity,
      depthRequired: input.depthRequired,
      mode: input.mode,
    },
  };
}
