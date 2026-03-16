import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { epistemicStateMerger } from "./epistemic-state-merger";
import { conflictResolutionEngine } from "./conflict-resolution-engine";
import { finalCognitiveHandoff } from "./final-cognitive-handoff";
import { handoffEpistemicIntegrationToGeneration } from "./epistemic-integration-to-generation-bridge";

export async function runEpistemicIntegrationLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();

  const merged = epistemicStateMerger(state);
  const conflict = conflictResolutionEngine({
    caveats: state.criticalCaveats,
    assumptions: state.reflectiveNotes.assumptions,
    tensions: state.reflectiveNotes.tensions,
  });
  const handoff = finalCognitiveHandoff({
    summary: merged.summary,
    certaintyBand: merged.certaintyBand,
    harmonyScore: conflict.harmonyScore,
    revisionNeeded: state.metacognitiveState.revisionNeeded,
  });

  state.epistemicIntegrationState = {
    mergedSummary: merged.summary,
    certaintyBand: merged.certaintyBand,
    conflicts: conflict.conflicts,
    harmonyScore: conflict.harmonyScore,
    finalHandoff: handoff,
  };
  state.activeContext = [...state.activeContext, handoff].slice(-18);
  state.activeConstraints = [
    ...new Set([
      ...state.activeConstraints,
      ...(conflict.harmonyScore < 0.5 ? ["epistemic_low_harmony"] : []),
      ...(state.metacognitiveState.revisionNeeded ? ["epistemic_revision_requested"] : []),
    ]),
  ].slice(-32);

  state.trace.push(
    makeTraceEvent({
      layer: "epistemic-integration",
      action: "epistemic_state_integrated",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail: `certainty=${merged.certaintyBand}; harmony=${conflict.harmonyScore.toFixed(2)}; conflicts=${conflict.conflicts.length}`,
    }),
  );

  return handoffEpistemicIntegrationToGeneration(state);
}
