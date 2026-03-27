import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { epistemicStateMerger } from "./epistemic-state-merger";
import { conflictResolutionEngine } from "./conflict-resolution-engine";
import { finalCognitiveHandoff } from "./final-cognitive-handoff";
import { handoffEpistemicIntegrationToGeneration } from "./epistemic-integration-to-generation-bridge";
import { runEpistemicIntegrationOrchestrator } from "./epistemic-integration-orchestrator";
import { runEpistemicToIterativeAcquisitionBridge } from "./epistemic-to-iterative-acquisition-bridge";

function buildClaimKindsCounter(claims: Array<{ kind: "fact" | "inference" | "hypothesis" | "speculation" | "open_question" }>) {
  const counter = {
    fact: 0,
    inference: 0,
    hypothesis: 0,
    speculation: 0,
    open_question: 0,
  };
  for (const claim of claims) {
    counter[claim.kind] += 1;
  }
  return counter;
}

export async function runEpistemicIntegrationLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const acquisitionBundle = await runEpistemicToIterativeAcquisitionBridge(state);
  const audit = runEpistemicIntegrationOrchestrator(state);

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
  state.epistemicAuditState = {
    claimCount: audit.claims.length,
    claimKinds: buildClaimKindsCounter(audit.claims),
    overclaimRisk: audit.boundaries.overclaimRisk,
    uncertaintySignals: audit.uncertainty.signals,
    confidence: audit.confidence,
  };
  state.executionArtifacts = {
    ...state.executionArtifacts,
    epistemicAudit: {
      claimCount: audit.claims.length,
      overclaimRisk: audit.boundaries.overclaimRisk,
      uncertaintySignals: audit.uncertainty.signals,
      confidence: audit.confidence,
      boundaryFlags: audit.boundaries.extrapolationFlags,
      iterativeAcquisitionRounds: acquisitionBundle?.executedRounds.length || 0,
      iterativeSufficiency: acquisitionBundle?.sufficiencyEstimate ?? null,
    },
  };
  state.activeContext = [...state.activeContext, handoff].slice(-18);
  state.activeConstraints = [
    ...new Set([
      ...state.activeConstraints,
      ...(conflict.harmonyScore < 0.5 ? ["epistemic_low_harmony"] : []),
      ...(state.metacognitiveState.revisionNeeded ? ["epistemic_revision_requested"] : []),
      ...(audit.boundaries.extrapolationFlags.length ? ["epistemic_extrapolation_risk"] : []),
    ]),
  ].slice(-32);

  state.trace.push(
    makeTraceEvent({
      layer: "epistemic-integration",
      action: "epistemic_state_integrated",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `certainty=${merged.certaintyBand}; harmony=${conflict.harmonyScore.toFixed(2)}; conflicts=${conflict.conflicts.length}; ` +
        `claims=${audit.claims.length}; overclaim=${audit.boundaries.overclaimRisk.toFixed(2)}; epistemicConfidence=${audit.confidence.toFixed(2)}`,
    }),
  );

  return handoffEpistemicIntegrationToGeneration(state);
}
