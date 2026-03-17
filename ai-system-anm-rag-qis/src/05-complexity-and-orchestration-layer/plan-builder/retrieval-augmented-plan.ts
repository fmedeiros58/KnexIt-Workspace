export interface RetrievalAugmentedPlanInput {
  steps: string[];
  needRetrieval: boolean;
}

export interface RetrievalAugmentedPlanOutput {
  steps: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function retrievalAugmentedPlan(input: RetrievalAugmentedPlanInput): RetrievalAugmentedPlanOutput {
  const retrievalSteps = input.needRetrieval
    ? ["retrieve_memory", "retrieve_knowledge", "merge_evidence"]
    : [];
  const steps = [...input.steps, ...retrievalSteps];

  return {
    steps,
    ok: true,
    component: "retrieval-augmented-plan",
    score: Number((input.needRetrieval ? 0.78 : 0.46).toFixed(4)),
    detail: `needRetrieval=${input.needRetrieval}`,
    context: {},
  };
}
