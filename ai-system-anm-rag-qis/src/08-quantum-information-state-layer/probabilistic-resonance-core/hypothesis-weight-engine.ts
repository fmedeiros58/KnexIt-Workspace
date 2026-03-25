import type { QuantumHypothesis } from "../quantum-core-types";

export interface HypothesisWeightEngineInput {
  hypotheses: QuantumHypothesis[];
  evidenceWeights: Record<string, number>;
  memoryWeights: Record<string, number>;
  contextualPriors: Record<string, number>;
}

export interface HypothesisWeightEngineOutput {
  hypotheses: QuantumHypothesis[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function hypothesisWeightEngine(input: HypothesisWeightEngineInput): HypothesisWeightEngineOutput {
  const weighted = input.hypotheses.map((hypothesis) => {
    const evidence = input.evidenceWeights[hypothesis.id] ?? hypothesis.evidenceSupport;
    const memory = input.memoryWeights[hypothesis.id] ?? hypothesis.memorySupport;
    const prior = input.contextualPriors[hypothesis.id] ?? hypothesis.contextSupport;
    const combined = (evidence * 0.42) + (memory * 0.24) + (prior * 0.22) + (hypothesis.coherence * 0.12);
    return {
      ...hypothesis,
      weight: Number(Math.max(0.05, Math.min(0.98, combined)).toFixed(6)),
    };
  });

  const avg = weighted.length
    ? weighted.reduce((sum, item) => sum + item.weight, 0) / weighted.length
    : 0;

  return {
    hypotheses: weighted,
    ok: true,
    component: "hypothesis-weight-engine",
    score: Number(avg.toFixed(4)),
    detail: `weighted=${weighted.length}`,
    context: {},
  };
}
