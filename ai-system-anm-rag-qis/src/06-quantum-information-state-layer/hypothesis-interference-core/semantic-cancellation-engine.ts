import type { QuantumHypothesis } from "../quantum-core-types";

export interface SemanticCancellationEngineInput {
  hypotheses: QuantumHypothesis[];
}

export interface SemanticCancellationEngineOutput {
  hypotheses: QuantumHypothesis[];
  cancellationCount: number;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

const NEGATION_PATTERN = /\b(n[oã]o|not|never|nunca|jamais)\b/i;

export function semanticCancellationEngine(input: SemanticCancellationEngineInput): SemanticCancellationEngineOutput {
  const flags = input.hypotheses.map((hypothesis) => NEGATION_PATTERN.test(hypothesis.claim));
  let cancellationCount = 0;
  const hasMixedPolarity = flags.some(Boolean) && flags.some((flag) => !flag);

  const hypotheses = input.hypotheses.map((hypothesis, index) => {
    if (!hasMixedPolarity) return hypothesis;
    const penalty = flags[index] ? 0.05 : 0.03;
    cancellationCount += 1;
    return {
      ...hypothesis,
      weight: Number(Math.max(0.05, Math.min(0.98, hypothesis.weight - penalty)).toFixed(6)),
    };
  });

  return {
    hypotheses,
    cancellationCount,
    ok: true,
    component: "semantic-cancellation-engine",
    score: Number(Math.max(0.1, 1 - (cancellationCount / Math.max(1, input.hypotheses.length * 2))).toFixed(4)),
    detail: `cancellations=${cancellationCount}`,
    context: {
      hasMixedPolarity,
    },
  };
}
