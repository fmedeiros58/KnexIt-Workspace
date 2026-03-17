import type { ProcessingState } from "../bridges/contracts/processing-state";

export interface EpistemicStateMergeResult {
  summary: string;
  certaintyBand: "low" | "medium" | "high";
}

export function epistemicStateMerger(state: ProcessingState): EpistemicStateMergeResult {
  const summary = [
    state.collapsedTruth.summary,
    ...state.criticalCaveats.slice(0, 2),
    ...state.inferentialMap.implications.slice(0, 2),
  ]
    .filter(Boolean)
    .join(" | ");

  const certaintyBand =
    state.collapsedTruth.uncertainty <= 0.32 ? "high" :
    state.collapsedTruth.uncertainty <= 0.58 ? "medium" :
    "low";

  return { summary, certaintyBand };
}
