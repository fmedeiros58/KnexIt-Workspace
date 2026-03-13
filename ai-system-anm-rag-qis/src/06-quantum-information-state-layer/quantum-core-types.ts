import type { HypothesisItem } from "../shared/types/common-types";

export interface QuantumHypothesis extends HypothesisItem {
  coherence: number;
  evidenceSupport: number;
  memorySupport: number;
  contextSupport: number;
}

export interface QuantumConvergence {
  dominantId: string | null;
  fusedSummary: string;
  synthesisSummary: string;
  confidence: number;
  converged: boolean;
}
