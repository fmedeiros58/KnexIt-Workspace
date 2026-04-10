/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 07-knowledge-retrieval-and-research-layer
 * Module: operators/retrieval-need-estimator
 * Responsibility: Estimate whether retrieval is locally needed for the current turn.
 * Primary Inputs: ProcessingState and layer mode.
 * Primary Outputs: Retrieval need decision.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: knowledge-layer
 * Invariants: Estimation is local and deterministic.
 * Failure Modes: Missing cues degrade to no retrieval.
 * Audit Events: retrieval_need_estimated
 * Notes: Complements orchestration-level retrieval policy with local evidence.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function retrievalNeedEstimator(state: ProcessingState, mode: LayerMode) {
  const needed =
    mode === "retrieval-heavy" ||
    state.preRouteSignals.hasRecencySignal ||
    state.preRouteSignals.hasVerifiableSignal ||
    state.adaptivePipelineContract?.retrievalPolicy === "heavy";
  return {
    needed,
    rationale: needed ? ["verifiable_or_recent_signal"] : ["no_retrieval_pressure"],
  };
}
