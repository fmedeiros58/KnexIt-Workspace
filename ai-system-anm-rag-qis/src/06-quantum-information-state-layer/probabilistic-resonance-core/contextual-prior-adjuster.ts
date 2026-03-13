import type { QuantumHypothesis } from "../quantum-core-types";

export interface ContextualPriorAdjusterInput {
  hypotheses: QuantumHypothesis[];
  ambiguity: number;
}

export interface ContextualPriorAdjusterOutput {
  priors: Record<string, number>;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function contextualPriorAdjuster(input: ContextualPriorAdjusterInput): ContextualPriorAdjusterOutput {
  const ambiguity = Math.max(0, Math.min(1, input.ambiguity));
  const ambiguityPenalty = ambiguity * 0.18;
  const priors = Object.fromEntries(
    input.hypotheses.map((hypothesis, index) => {
      const rankPenalty = index * 0.03;
      const prior = Math.max(0.05, Math.min(0.98, hypothesis.contextSupport - ambiguityPenalty - rankPenalty));
      return [hypothesis.id, Number(prior.toFixed(6))];
    }),
  );

  const avg = input.hypotheses.length
    ? input.hypotheses.reduce((sum, item) => sum + (priors[item.id] ?? 0), 0) / input.hypotheses.length
    : 0;

  return {
    priors,
    ok: true,
    component: "contextual-prior-adjuster",
    score: Number(avg.toFixed(4)),
    detail: `ambiguity=${ambiguity.toFixed(3)}`,
    context: {
      ambiguity: Number(ambiguity.toFixed(4)),
    },
  };
}
