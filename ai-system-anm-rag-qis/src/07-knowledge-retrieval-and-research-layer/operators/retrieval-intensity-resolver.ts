/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 07-knowledge-retrieval-and-research-layer
 * Module: operators/retrieval-intensity-resolver
 * Responsibility: Resolve retrieval intensity from local mode and state.
 * Primary Inputs: ProcessingState and layer mode.
 * Primary Outputs: Retrieval intensity label.
 * Upstream Dependencies: local retrieval-need-estimator
 * Downstream Dependencies: knowledge-layer
 * Invariants: Intensity is bounded to light/standard/heavy.
 * Failure Modes: Missing signals degrade to light.
 * Audit Events: retrieval_intensity_resolved
 * Notes: Keeps retrieval scaling local to the knowledge layer.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";
import { retrievalNeedEstimator } from "./retrieval-need-estimator";

export function retrievalIntensityResolver(state: ProcessingState, mode: LayerMode) {
  const need = retrievalNeedEstimator(state, mode);
  if (!need.needed) return "light";
  if (mode === "retrieval-heavy") return "heavy";
  return state.preRouteSignals.hasRecencySignal ? "heavy" : "standard";
}
