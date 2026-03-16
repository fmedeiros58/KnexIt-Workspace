import type { QuantumHypothesis } from "../quantum-core-types";

export interface CoherenceCompetitionEngineInput {
  hypotheses: QuantumHypothesis[];
}

export interface CoherenceCompetitionEngineOutput {
  hypotheses: QuantumHypothesis[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function coherenceCompetitionEngine(input: CoherenceCompetitionEngineInput): CoherenceCompetitionEngineOutput {
  const adjusted = input.hypotheses.map((hypothesis) => ({
    ...hypothesis,
    weight: Number(Math.max(0.05, Math.min(0.98, hypothesis.weight + ((hypothesis.coherence - 0.5) * 0.18))).toFixed(6)),
  }));

  const avg = adjusted.length
    ? adjusted.reduce((sum, item) => sum + item.weight, 0) / adjusted.length
    : 0;

  return {
    hypotheses: adjusted,
    ok: true,
    component: "coherence-competition-engine",
    score: Number(avg.toFixed(4)),
    detail: `adjusted=${adjusted.length}`,
    context: {},
  };
}
