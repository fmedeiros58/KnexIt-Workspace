import type { QuantumHypothesis } from "../quantum-core-types";

export interface LowValidityPrunerInput {
  hypotheses: QuantumHypothesis[];
  minWeight?: number;
}

export interface LowValidityPrunerOutput {
  hypotheses: QuantumHypothesis[];
  prunedCount: number;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function lowValidityPruner(input: LowValidityPrunerInput): LowValidityPrunerOutput {
  const minWeight = Math.max(0.05, Math.min(0.5, input.minWeight ?? 0.14));
  const kept = input.hypotheses.filter((item) => item.weight >= minWeight);
  const hypotheses = kept.length ? kept : input.hypotheses.slice(0, Math.min(2, input.hypotheses.length));
  const prunedCount = Math.max(0, input.hypotheses.length - hypotheses.length);

  return {
    hypotheses,
    prunedCount,
    ok: true,
    component: "low-validity-pruner",
    score: Number((1 - (prunedCount / Math.max(1, input.hypotheses.length))).toFixed(4)),
    detail: `pruned=${prunedCount}`,
    context: {
      minWeight,
    },
  };
}
