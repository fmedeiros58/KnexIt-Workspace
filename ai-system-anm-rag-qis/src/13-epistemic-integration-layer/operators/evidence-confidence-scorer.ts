/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 13-epistemic-integration-layer
 * Module: operators/evidence-confidence-scorer
 * Responsibility: Score local evidence confidence from retrieved evidence and sources.
 * Primary Inputs: ProcessingState and layer mode.
 * Primary Outputs: Evidence confidence score.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: epistemic-integration-layer
 * Invariants: Score remains bounded to [0,1].
 * Failure Modes: Empty evidence degrades to low confidence.
 * Audit Events: evidence_confidence_scored
 * Notes: This is a local epistemic signal, not the final validation verdict.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function evidenceConfidenceScorer(state: ProcessingState, mode: LayerMode): number {
  const sourceFactor = Math.min(1, state.retrievedSources.length / (mode === "heavy" ? 6 : 4));
  const evidenceFactor = Math.min(1, state.retrievedEvidence.length / (mode === "heavy" ? 8 : 4));
  return Number(Math.max(0, Math.min(1, (sourceFactor * 0.55) + (evidenceFactor * 0.45))).toFixed(4));
}
