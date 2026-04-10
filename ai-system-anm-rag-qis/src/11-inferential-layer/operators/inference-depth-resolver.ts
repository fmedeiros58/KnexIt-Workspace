/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 11-inferential-layer
 * Module: operators/inference-depth-resolver
 * Responsibility: Resolve local inferential depth from state and layer mode.
 * Primary Inputs: ProcessingState and layer mode.
 * Primary Outputs: Inference depth label.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: inferential-layer
 * Invariants: Resolution is local and deterministic.
 * Failure Modes: Missing signals degrade to medium inference.
 * Audit Events: inference_depth_resolved
 * Notes: Keeps inferential intensity decisions in layer 11.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function inferenceDepthResolver(state: ProcessingState, mode: LayerMode) {
  if (mode === "heavy" || state.deliberativeTaskState.isActive) return "heavy";
  if (state.complexityProfile.score >= 0.6 || state.hypothesisSet.length > 2) return "medium";
  return "light";
}
