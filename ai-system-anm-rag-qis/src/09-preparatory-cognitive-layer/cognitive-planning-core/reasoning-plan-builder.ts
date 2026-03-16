export interface ReasoningPlanInput {
  goal: string;
  route: string;
  ambiguity: number;
}

export interface ReasoningPlan {
  steps: string[];
}

export function reasoningPlanBuilder(input: ReasoningPlanInput): ReasoningPlan {
  const steps = ["frame_problem"];
  if (input.ambiguity >= 0.5) steps.push("disambiguate_scope");
  if (input.route !== "minimum") steps.push("collect_evidence");
  if (input.route === "inferential" || input.route === "quantum-state") steps.push("project_implications");
  steps.push(input.goal === "implement" ? "produce_actionable_answer" : "produce_contextual_answer");
  return { steps };
}
