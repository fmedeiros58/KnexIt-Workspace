/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 10-reflective-layer
 * Module: operators/reflection-depth-resolver
 * Responsibility: Resolve local reflective depth from state and layer mode.
 * Primary Inputs: ProcessingState and layer mode.
 * Primary Outputs: Reflection depth label.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: reflective-layer
 * Invariants: Resolution is local and deterministic.
 * Failure Modes: Missing signals degrade to light reflection.
 * Audit Events: reflection_depth_resolved
 * Notes: Keeps reflective intensity logic inside layer 10.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function reflectionDepthResolver(state: ProcessingState, mode: LayerMode) {
  if (mode === "heavy" || mode === "epistemic-heavy") return "heavy";
  if (state.deliberativeTaskState.isActive || state.adaptivePipelineContract?.reflectionPolicy === "heavy") return "heavy";
  if (state.criticalCaveats.length || state.conversationState.needsClarification) return "medium";
  return "light";
}
