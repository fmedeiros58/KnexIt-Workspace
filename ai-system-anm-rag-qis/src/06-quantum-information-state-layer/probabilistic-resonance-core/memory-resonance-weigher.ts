import type { QuantumHypothesis } from "../quantum-core-types";

export interface MemoryResonanceWeigherInput {
  hypotheses: QuantumHypothesis[];
  memorySignal: number;
}

export interface MemoryResonanceWeigherOutput {
  weights: Record<string, number>;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function memoryResonanceWeigher(input: MemoryResonanceWeigherInput): MemoryResonanceWeigherOutput {
  const memoryFactor = Math.max(0, Math.min(1, input.memorySignal / 12));
  const weights = Object.fromEntries(
    input.hypotheses.map((hypothesis) => {
      const weight = Math.max(0.05, Math.min(0.98, hypothesis.memorySupport + (memoryFactor * 0.2)));
      return [hypothesis.id, Number(weight.toFixed(6))];
    }),
  );

  const avg = input.hypotheses.length
    ? input.hypotheses.reduce((sum, item) => sum + (weights[item.id] ?? 0), 0) / input.hypotheses.length
    : 0;

  return {
    weights,
    ok: true,
    component: "memory-resonance-weigher",
    score: Number(avg.toFixed(4)),
    detail: `memorySignal=${input.memorySignal}`,
    context: {
      memoryFactor: Number(memoryFactor.toFixed(4)),
    },
  };
}
