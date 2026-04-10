/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 13-epistemic-integration-layer
 * Module: epistemic-integration-layer-bridge
 * Responsibility: Integrate epistemic state and apply local epistemic operators before generation handoff.
 * Primary Inputs: ProcessingState, iterative acquisition outputs and local epistemic operators.
 * Primary Outputs: Updated epistemic integration state, epistemic audit payload and generation handoff.
 * Upstream Dependencies: inferential/metacognitive layers, iterative acquisition, local epistemic operators
 * Downstream Dependencies: generation layer
 * Invariants: Epistemic integration remains a consolidator; it does not rewrite upstream reasoning artifacts wholesale.
 * Failure Modes: Sparse evidence degrades to lower confidence and explicit conflict retention.
 * Audit Events: epistemic_state_integrated
 * Notes: Local evidence/support operators make support and conflict boundaries explicit instead of implicit.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { resolveLayerModeFromState } from "../05-complexity-and-orchestration-layer/activation-policy/layer-mode-resolver";
import { epistemicStateMerger } from "./epistemic-state-merger";
import { conflictResolutionEngine } from "./conflict-resolution-engine";
import { finalCognitiveHandoff } from "./final-cognitive-handoff";
import { handoffEpistemicIntegrationToGeneration } from "./epistemic-integration-to-generation-bridge";
import { runEpistemicIntegrationOrchestrator } from "./epistemic-integration-orchestrator";
import { runEpistemicToIterativeAcquisitionBridge } from "./epistemic-to-iterative-acquisition-bridge";
import { evidenceConfidenceScorer } from "./operators/evidence-confidence-scorer";
import { claimSupportMapper } from "./operators/claim-support-mapper";
import { conflictConsolidator } from "./operators/conflict-consolidator";

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
  const epistemicMode = resolveLayerModeFromState(state, "epistemic-integration");
  const acquisitionBundle = await runEpistemicToIterativeAcquisitionBridge(state);
  const audit = runEpistemicIntegrationOrchestrator(state);
  const localEvidenceConfidence = evidenceConfidenceScorer(state, epistemicMode);
  const claimSupport = claimSupportMapper(state, epistemicMode);

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
  const consolidatedConflicts = conflictConsolidator(state, epistemicMode);
  state.epistemicIntegrationState.conflicts = consolidatedConflicts;
  state.epistemicAuditState = {
    claimCount: audit.claims.length,
    claimKinds: buildClaimKindsCounter(audit.claims),
    overclaimRisk: audit.boundaries.overclaimRisk,
    uncertaintySignals: audit.uncertainty.signals,
    confidence: Number(((audit.confidence * 0.7) + (localEvidenceConfidence * 0.3)).toFixed(4)),
  };
  state.executionArtifacts = {
    ...state.executionArtifacts,
    epistemicAudit: {
      claimCount: audit.claims.length,
      overclaimRisk: audit.boundaries.overclaimRisk,
      uncertaintySignals: audit.uncertainty.signals,
      confidence: Number(((audit.confidence * 0.7) + (localEvidenceConfidence * 0.3)).toFixed(4)),
      boundaryFlags: audit.boundaries.extrapolationFlags,
      evidenceConfidence: localEvidenceConfidence,
      claimSupportCount: claimSupport.length,
      consolidatedConflictCount: consolidatedConflicts.length,
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
      ...(localEvidenceConfidence < 0.45 ? ["epistemic_local_evidence_low"] : ["epistemic_local_evidence_supported"]),
    ]),
  ].slice(-32);

  state.trace.push(
    makeTraceEvent({
      layer: "epistemic-integration",
      action: "epistemic_state_integrated",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `mode=${epistemicMode}; certainty=${merged.certaintyBand}; harmony=${conflict.harmonyScore.toFixed(2)}; conflicts=${consolidatedConflicts.length}; ` +
        `claims=${audit.claims.length}; supportMap=${claimSupport.length}; overclaim=${audit.boundaries.overclaimRisk.toFixed(2)}; ` +
        `epistemicConfidence=${audit.confidence.toFixed(2)}; evidenceConfidence=${localEvidenceConfidence.toFixed(2)}`,
    }),
  );

  return handoffEpistemicIntegrationToGeneration(state);
}
