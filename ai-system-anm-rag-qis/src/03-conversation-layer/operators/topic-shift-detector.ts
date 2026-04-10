/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 03-conversation-layer
 * Module: operators/topic-shift-detector
 * Responsibility: Detect likely topic shifts from the current turn and active conversation topic.
 * Primary Inputs: ProcessingState and layer mode.
 * Primary Outputs: Topic shift decision and candidate topic.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: conversation-layer
 * Invariants: Detection is local and does not mutate global state.
 * Failure Modes: Empty messages degrade to no topic shift.
 * Audit Events: topic_shift_detected
 * Notes: Intended for adaptive carryover decisions.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function topicShiftDetector(state: ProcessingState, mode: LayerMode) {
  const activeTopic = `${state.conversationState.activeTopic || "general"}`.trim().toLowerCase();
  const message = `${state.normalizedMessage || state.rawMessage || ""}`.trim().toLowerCase();
  if (!message) return { topicShift: false, candidateTopic: activeTopic, confidence: 0 };

  const candidateTopic = message.split(/\s+/).slice(0, mode === "heavy" ? 6 : 3).join("_") || activeTopic;
  const topicShift = Boolean(activeTopic && activeTopic !== "general" && !message.includes(activeTopic.replace(/_/g, " ")));
  return {
    topicShift,
    candidateTopic,
    confidence: topicShift ? 0.62 : 0.28,
  };
}
