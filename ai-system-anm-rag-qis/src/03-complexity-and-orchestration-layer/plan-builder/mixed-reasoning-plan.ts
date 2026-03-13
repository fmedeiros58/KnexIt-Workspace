import type { PipelineRoute } from "../../shared/enums/pipeline-enums";

export interface MixedReasoningPlanInput {
  steps: string[];
  route: PipelineRoute;
}

export interface MixedReasoningPlanOutput {
  steps: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function mixedReasoningPlan(input: MixedReasoningPlanInput): MixedReasoningPlanOutput {
  const reasoningSteps =
    input.route === "quantum-state"
      ? ["quantum_superposition", "hypothesis_interference", "truth_collapse"]
      : input.route === "inferential"
        ? ["infer_implications", "project_scenarios"]
        : input.route === "reflective"
          ? ["critical_reflection"]
          : ["direct_reasoning"];
  const steps = [...input.steps, ...reasoningSteps];

  return {
    steps,
    ok: true,
    component: "mixed-reasoning-plan",
    score: Number((input.route === "quantum-state" ? 0.9 : input.route === "inferential" ? 0.78 : 0.62).toFixed(4)),
    detail: `route=${input.route}`,
    context: {},
  };
}
