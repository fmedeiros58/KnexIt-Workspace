import { responseBudgetEstimator } from "../../src/05-complexity-and-orchestration-layer/complexity-evaluator/response-budget-estimator";

describe("responseBudgetEstimator", () => {
  test("reserves budget per obligation and for final synthesis in deep tasks", () => {
    const baseline = responseBudgetEstimator({
      complexityScore: 0.45,
      depthRequired: 8,
      mode: "analysis",
      obligationCount: 1,
      requiresStructuredCoverage: false,
      requiresFormalization: false,
      requiresCounterObjection: false,
      requiresAssumptionAudit: false,
      requiresAlternatives: false,
      argumentativeDepthScore: 0.2,
      reasoningIntensity: 0.3,
      structuralComplexity: 0.25,
    });

    const deep = responseBudgetEstimator({
      complexityScore: 0.78,
      depthRequired: 15,
      mode: "analysis",
      obligationCount: 8,
      requiresStructuredCoverage: true,
      requiresFormalization: true,
      requiresCounterObjection: true,
      requiresAssumptionAudit: true,
      requiresAlternatives: true,
      argumentativeDepthScore: 0.88,
      reasoningIntensity: 0.82,
      structuralComplexity: 0.8,
    });

    expect(deep.responseBudget).toBeGreaterThan(baseline.responseBudget);
    expect(Number(deep.context.reservedBudgetForObligations)).toBeGreaterThan(0);
    expect(Number(deep.context.reservedBudgetForFinalSynthesis)).toBeGreaterThan(0);
  });
});

