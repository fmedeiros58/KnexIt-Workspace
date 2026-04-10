/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 06-memory-and-plasticity-layer
 * Module: operators/memory-write-policy
 * Responsibility: Resolve whether the current turn is worth writing back into memory.
 * Primary Inputs: ProcessingState and layer mode.
 * Primary Outputs: Memory write policy decision.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: memory-layer, feedback layer
 * Invariants: Policy is local and conservative.
 * Failure Modes: Missing signals degrade to no write.
 * Audit Events: memory_write_policy_resolved
 * Notes: Prevents indiscriminate memory writes in light modes.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function memoryWritePolicy(state: ProcessingState, mode: LayerMode) {
  const novelty = state.deliberativeTaskState.isActive || state.preRouteSignals.hasRecencySignal || state.conversationState.topicShiftDetected;
  return {
    shouldWrite: mode === "memory-heavy" || (mode !== "noop-intelligent" && novelty),
    reasons: novelty ? ["novel_or_session_relevant"] : ["no_persistent_memory_signal"],
  };
}
