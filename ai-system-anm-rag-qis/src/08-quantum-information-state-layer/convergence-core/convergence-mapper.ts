import type { QuantumHypothesis } from "../quantum-core-types";

export interface ConvergenceMapperInput {
  hypotheses: QuantumHypothesis[];
}

export interface ConvergenceMapperOutput {
  ordered: QuantumHypothesis[];
  convergenceScore: number;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function convergenceMapper(input: ConvergenceMapperInput): ConvergenceMapperOutput {
  const ordered = [...input.hypotheses].sort((a, b) => b.weight - a.weight);
  const top = ordered[0]?.weight ?? 0;
  const second = ordered[1]?.weight ?? 0;
  const convergenceScore = Math.max(0, Math.min(1, top - second + 0.4));

  return {
    ordered,
    convergenceScore: Number(convergenceScore.toFixed(4)),
    ok: true,
    component: "convergence-mapper",
    score: Number(convergenceScore.toFixed(4)),
    detail: `topGap=${(top - second).toFixed(4)}`,
    context: {
      hypothesisCount: ordered.length,
    },
  };
}
