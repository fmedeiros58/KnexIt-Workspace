export interface ProbabilisticOutcomeBalancerInput {
  outcomes: string[];
  confidence: number;
}

export interface ProbabilisticOutcomeBalancerOutput {
  balancedOutcomes: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function probabilisticOutcomeBalancer(input: ProbabilisticOutcomeBalancerInput): ProbabilisticOutcomeBalancerOutput {
  const confidence = Math.max(0, Math.min(1, input.confidence));
  const qualifier = confidence >= 0.7 ? "provavel" : confidence >= 0.45 ? "plausivel" : "incerto";
  const balancedOutcomes = input.outcomes.slice(0, 6).map((item) => `[${qualifier}] ${item}`);

  return {
    balancedOutcomes,
    ok: true,
    component: "probabilistic-outcome-balancer",
    score: Number(confidence.toFixed(4)),
    detail: `balanced=${balancedOutcomes.length}`,
    context: {
      confidence,
      outcomeCount: input.outcomes.length,
    },
  };
}
