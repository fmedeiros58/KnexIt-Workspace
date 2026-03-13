import type { QuantumHypothesis } from "../quantum-core-types";

export interface ContradictionInterferenceInput {
  hypotheses: QuantumHypothesis[];
}

export interface ContradictionInterferenceOutput {
  hypotheses: QuantumHypothesis[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function contradictionInterference(input: ContradictionInterferenceInput): ContradictionInterferenceOutput {
  const adjusted = input.hypotheses.map((hypothesis) => {
    const penalty = Math.min(0.28, hypothesis.contradictorySources.length * 0.09);
    return {
      ...hypothesis,
      weight: Number(Math.max(0.05, Math.min(0.98, hypothesis.weight - penalty)).toFixed(6)),
    };
  });

  const avg = adjusted.length
    ? adjusted.reduce((sum, item) => sum + item.weight, 0) / adjusted.length
    : 0;

  return {
    hypotheses: adjusted,
    ok: true,
    component: "contradiction-interference",
    score: Number(avg.toFixed(4)),
    detail: `adjusted=${adjusted.length}`,
    context: {},
  };
}
