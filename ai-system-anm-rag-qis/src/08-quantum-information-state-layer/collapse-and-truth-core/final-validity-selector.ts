import type { QuantumHypothesis } from "../quantum-core-types";

export function selectFinalValidity(hypotheses: QuantumHypothesis[]): QuantumHypothesis | null {
  if (!hypotheses.length) return null;
  const ordered = [...hypotheses].sort((a, b) => b.weight - a.weight);
  return ordered[0] || null;
}
