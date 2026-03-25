import type { QuantumHypothesis } from "../quantum-core-types";

export interface SemanticProbabilityDistributorInput {
  hypotheses: QuantumHypothesis[];
}

export interface SemanticProbabilityDistributorOutput {
  normalized: Record<string, number>;
  entropy: number;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function semanticProbabilityDistributor(input: SemanticProbabilityDistributorInput): SemanticProbabilityDistributorOutput {
  const total = input.hypotheses.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  const normalized = total <= 0
    ? Object.fromEntries(input.hypotheses.map((item) => [item.id, Number((1 / Math.max(1, input.hypotheses.length)).toFixed(6))]))
    : Object.fromEntries(
      input.hypotheses.map((item) => [item.id, Number((Math.max(0, item.weight) / total).toFixed(6))]),
    );

  const entropy = Object.values(normalized).reduce((sum, probability) => {
    if (probability <= 0) return sum;
    return sum - (probability * Math.log2(probability));
  }, 0);

  return {
    normalized,
    entropy: Number(entropy.toFixed(6)),
    ok: true,
    component: "semantic-probability-distributor",
    score: Number(Math.min(1, entropy / 2).toFixed(4)),
    detail: `entropy=${entropy.toFixed(4)}`,
    context: {
      hypothesisCount: input.hypotheses.length,
    },
  };
}
