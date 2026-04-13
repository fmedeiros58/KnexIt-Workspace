/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: complexity-evaluator/response-budget-estimator
 * Responsibility: Estimate the response budget used by the descending pipeline after orchestration.
 * Primary Inputs: Heuristic complexity, deliberative burden and optional budget class hint from the short motor read.
 * Primary Outputs: ResponseBudgetEstimatorOutput
 * Upstream Dependencies: none
 * Downstream Dependencies: orchestration-layer, adaptive contract builder
 * Invariants: Budget estimation remains bounded and deterministic.
 * Failure Modes: Invalid hints degrade to the default bounded heuristic budget.
 * Audit Events: response_budget_estimated
 * Notes: The motor hint modulates, but does not replace, the local heuristic estimator.
 */
export interface ResponseBudgetEstimatorInput {
  complexityScore: number;
  depthRequired: number;
  mode: string;
  argumentativeDepthScore?: number;
  reasoningIntensity?: number;
  structuralComplexity?: number;
  obligationCount?: number;
  requiresFormalization?: boolean;
  requiresStructuredCoverage?: boolean;
  requiresCounterObjection?: boolean;
  requiresAssumptionAudit?: boolean;
  requiresAlternatives?: boolean;
  budgetClassHint?: "tight" | "standard" | "expanded";
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
  const argumentativeDepthScore = Math.max(0, Math.min(1, input.argumentativeDepthScore || 0));
  const reasoningIntensity = Math.max(0, Math.min(1, input.reasoningIntensity || 0));
  const structuralComplexity = Math.max(0, Math.min(1, input.structuralComplexity || 0));
  const obligationCount = Math.max(0, Math.min(16, input.obligationCount || 0));
  const reservePerObligation =
    input.requiresStructuredCoverage || input.requiresFormalization
      ? 90
      : input.requiresAlternatives || input.requiresCounterObjection
        ? 72
        : 56;
  const reservedBudgetForObligations = Math.round(obligationCount * reservePerObligation);
  const reservedBudgetForFinalSynthesis =
    (input.requiresStructuredCoverage ? 180 : 80) +
    (input.requiresCounterObjection ? 70 : 0) +
    (input.requiresAssumptionAudit ? 60 : 0);
  const deliberativeBoost =
    (input.requiresFormalization ? 220 : 0) +
    (input.requiresStructuredCoverage ? 180 : 0) +
    (input.requiresCounterObjection ? 120 : 0) +
    (input.requiresAssumptionAudit ? 100 : 0) +
    (input.requiresAlternatives ? 120 : 0) +
    Math.round(argumentativeDepthScore * 180) +
    Math.round(reasoningIntensity * 220) +
    Math.round(structuralComplexity * 180) +
    Math.round(obligationCount * 24) +
    reservedBudgetForObligations +
    reservedBudgetForFinalSynthesis;

  let responseBudget = 320 + Math.round((complexity * 780) + (depthFactor * 380)) + deliberativeBoost;
  if (input.mode === "summary") responseBudget = Math.round(responseBudget * 0.72);
  if (input.mode === "research" || input.mode === "technical") responseBudget = Math.round(responseBudget * 1.12);

  const budgetClassMultiplier = input.budgetClassHint === "tight"
    ? 0.82
    : input.budgetClassHint === "expanded"
      ? 1.18
      : 1;

  responseBudget = Math.round(responseBudget * budgetClassMultiplier);
  responseBudget = Math.max(220, Math.min(4200, responseBudget));
  const score = Math.max(0, Math.min(1, responseBudget / 4200));

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
      argumentativeDepthScore,
      reasoningIntensity,
      structuralComplexity,
      obligationCount,
      reservedBudgetForObligations,
      reservedBudgetForFinalSynthesis,
      requiresFormalization: input.requiresFormalization === true,
      requiresStructuredCoverage: input.requiresStructuredCoverage === true,
      requiresCounterObjection: input.requiresCounterObjection === true,
      requiresAssumptionAudit: input.requiresAssumptionAudit === true,
      requiresAlternatives: input.requiresAlternatives === true,
      budgetClassHint: input.budgetClassHint || "standard",
      budgetClassMultiplier,
    },
  };
}
