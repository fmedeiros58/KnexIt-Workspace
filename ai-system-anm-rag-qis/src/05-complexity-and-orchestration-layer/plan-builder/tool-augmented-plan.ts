export interface ToolAugmentedPlanInput {
  steps: string[];
  mode: string;
  needWebSearch: boolean;
}

export interface ToolAugmentedPlanOutput {
  steps: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function toolAugmentedPlan(input: ToolAugmentedPlanInput): ToolAugmentedPlanOutput {
  const toolSteps = [
    input.mode === "technical" ? "tool:runtime_diagnostics" : "",
    input.mode === "research" ? "tool:source_ranking" : "",
    input.needWebSearch ? "tool:web_research" : "",
  ].filter(Boolean);
  const steps = [...input.steps, ...toolSteps];

  return {
    steps,
    ok: true,
    component: "tool-augmented-plan",
    score: Number(Math.min(1, (toolSteps.length * 0.22) + 0.45).toFixed(4)),
    detail: `toolSteps=${toolSteps.length}`,
    context: {},
  };
}
