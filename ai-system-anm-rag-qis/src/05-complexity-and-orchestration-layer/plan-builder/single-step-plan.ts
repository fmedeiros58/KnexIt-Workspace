import type { PipelineRoute } from "../../shared/enums/pipeline-enums";

export interface SingleStepPlanInput {
  route: PipelineRoute;
  mode: string;
}

export interface SingleStepPlanOutput {
  steps: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function singleStepPlan(input: SingleStepPlanInput): SingleStepPlanOutput {
  const steps = [
    `route:${input.route}`,
    `mode:${input.mode}`,
    "respond",
  ];

  return {
    steps,
    ok: true,
    component: "single-step-plan",
    score: 0.62,
    detail: steps.join(" -> "),
    context: {},
  };
}
