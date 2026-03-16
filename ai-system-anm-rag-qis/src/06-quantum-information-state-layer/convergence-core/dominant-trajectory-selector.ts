import type { QuantumHypothesis } from "../quantum-core-types";

export interface DominantTrajectorySelectorInput {
  ordered: QuantumHypothesis[];
}

export interface DominantTrajectorySelectorOutput {
  dominant: QuantumHypothesis | null;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function dominantTrajectorySelector(input: DominantTrajectorySelectorInput): DominantTrajectorySelectorOutput {
  const dominant = input.ordered[0] || null;
  const score = dominant?.weight ?? 0;

  return {
    dominant,
    ok: true,
    component: "dominant-trajectory-selector",
    score: Number(score.toFixed(4)),
    detail: dominant?.id || "none",
    context: {},
  };
}
