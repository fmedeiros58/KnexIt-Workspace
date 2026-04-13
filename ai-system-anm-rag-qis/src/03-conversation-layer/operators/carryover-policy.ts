/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 03-conversation-layer
 * Module: operators/carryover-policy
 * Responsibility: Resolve whether conversation context should be carried over into the next layer.
 * Primary Inputs: ProcessingState and layer mode.
 * Primary Outputs: Carryover policy decision.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode, local operators
 * Downstream Dependencies: conversation-layer, context/session layer
 * Invariants: Policy is local and recommendation-only.
 * Failure Modes: Missing signals degrade to conservative carryover.
 * Audit Events: carryover_policy_resolved
 * Notes: This module avoids leaking orchestration logic into the conversation layer.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";
import { continuityScorer } from "./continuity-scorer";
import { topicShiftDetector } from "./topic-shift-detector";

export function carryoverPolicy(state: ProcessingState, mode: LayerMode) {
  const continuity = continuityScorer(state, mode);
  const topicShift = topicShiftDetector(state, mode);
  const carryoverAllowed = continuity >= 0.34 && !topicShift.topicShift;
  return {
    carryoverAllowed,
    continuity,
    candidateTopic: topicShift.candidateTopic,
    reasons: carryoverAllowed ? ["continuity_sufficient"] : ["topic_shift_or_low_continuity"],
  };
}
