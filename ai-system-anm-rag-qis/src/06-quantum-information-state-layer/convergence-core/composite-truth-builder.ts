import type { QuantumConvergence, QuantumHypothesis } from "../quantum-core-types";

export interface CompositeTruthBuilderInput {
  dominant: QuantumHypothesis | null;
  fusedSummary: string;
  synthesisSummary: string;
  convergenceScore: number;
}

export interface CompositeTruthBuilderOutput {
  convergence: QuantumConvergence;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function compositeTruthBuilder(input: CompositeTruthBuilderInput): CompositeTruthBuilderOutput {
  const confidence = Math.max(0, Math.min(1, (input.dominant?.weight ?? 0) * 0.72 + (input.convergenceScore * 0.28)));
  const converged = confidence >= 0.55;
  const convergence: QuantumConvergence = {
    dominantId: input.dominant?.id || null,
    fusedSummary: input.fusedSummary,
    synthesisSummary: input.synthesisSummary,
    confidence: Number(confidence.toFixed(4)),
    converged,
  };

  return {
    convergence,
    ok: true,
    component: "composite-truth-builder",
    score: Number(confidence.toFixed(4)),
    detail: `dominant=${convergence.dominantId || "none"}`,
    context: {
      converged,
    },
  };
}
