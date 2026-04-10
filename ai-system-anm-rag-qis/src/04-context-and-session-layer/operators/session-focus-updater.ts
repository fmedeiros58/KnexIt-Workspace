/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 04-context-and-session-layer
 * Module: operators/session-focus-updater
 * Responsibility: Resolve the current session focus from active context and message cues.
 * Primary Inputs: ProcessingState and layer mode.
 * Primary Outputs: Focus descriptor and updated context fragment.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: context-layer
 * Invariants: The operator is local and does not mutate state directly.
 * Failure Modes: Empty messages degrade to existing active topic.
 * Audit Events: session_focus_updated
 * Notes: This keeps focus management within the context/session layer.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function sessionFocusUpdater(state: ProcessingState, mode: LayerMode) {
  const source = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  const focus = source ? source.split(/\s+/).slice(0, mode === "heavy" ? 5 : 3).join(" ") : state.conversationState.activeTopic;
  return {
    primaryFocus: focus || "general",
    updatedContext: [...state.activeContext.slice(-4), `session_focus:${focus || "general"}`],
  };
}
