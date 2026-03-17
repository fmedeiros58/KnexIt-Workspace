export interface MultiStepPlanInput {
  baseSteps: string[];
  depthRequired: number;
}

export interface MultiStepPlanOutput {
  steps: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function multiStepPlan(input: MultiStepPlanInput): MultiStepPlanOutput {
  const extraSteps = input.depthRequired >= 12
    ? ["validate_assumptions", "expand_implications", "final_refinement"]
    : input.depthRequired >= 9
      ? ["expand_implications", "final_refinement"]
      : ["final_refinement"];
  const steps = [...input.baseSteps, ...extraSteps];

  return {
    steps,
    ok: true,
    component: "multi-step-plan",
    score: Number(Math.min(1, steps.length / 12).toFixed(4)),
    detail: `steps=${steps.length}`,
    context: {
      depthRequired: input.depthRequired,
    },
  };
}
