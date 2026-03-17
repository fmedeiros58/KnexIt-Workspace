import type { QuantumHypothesis } from "../quantum-core-types";

export interface MutualReinforcementDetectorInput {
  hypotheses: QuantumHypothesis[];
}

export interface MutualReinforcementDetectorOutput {
  hypotheses: QuantumHypothesis[];
  reinforcedPairs: number;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function firstToken(value: string) {
  return value.toLowerCase().split(/\s+/).find(Boolean) || "";
}

export function mutualReinforcementDetector(input: MutualReinforcementDetectorInput): MutualReinforcementDetectorOutput {
  let reinforcedPairs = 0;
  const hypotheses = input.hypotheses.map((hypothesis, index, all) => {
    const token = firstToken(hypothesis.claim);
    const pairHits = all.filter((other, otherIndex) => otherIndex !== index && firstToken(other.claim) === token).length;
    if (pairHits > 0) reinforcedPairs += pairHits;
    const boost = Math.min(0.12, pairHits * 0.04);
    return {
      ...hypothesis,
      weight: Number(Math.max(0.05, Math.min(0.98, hypothesis.weight + boost)).toFixed(6)),
    };
  });

  return {
    hypotheses,
    reinforcedPairs,
    ok: true,
    component: "mutual-reinforcement-detector",
    score: Number(Math.min(1, reinforcedPairs / 6).toFixed(4)),
    detail: `reinforcedPairs=${reinforcedPairs}`,
    context: {},
  };
}
