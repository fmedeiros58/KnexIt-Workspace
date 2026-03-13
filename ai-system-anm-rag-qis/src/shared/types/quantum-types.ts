import type { HypothesisItem } from "./common-types";

export interface QuantumState {
  hypotheses: HypothesisItem[];
  normalizedWeights: Record<string, number>;
  converged: boolean;
}
