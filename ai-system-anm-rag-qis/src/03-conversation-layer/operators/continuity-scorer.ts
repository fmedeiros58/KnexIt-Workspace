/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 03-conversation-layer
 * Module: operators/continuity-scorer
 * Responsibility: Estimate continuity pressure across recent turns.
 * Primary Inputs: ProcessingState and layer mode.
 * Primary Outputs: Continuity score in [0,1].
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: conversation-layer
 * Invariants: Scoring is local and deterministic.
 * Failure Modes: Missing recent turns degrade to a low continuity score.
 * Audit Events: continuity_scored
 * Notes: Higher scores suggest stronger carryover value.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function continuityScorer(state: ProcessingState, mode: LayerMode): number {
  const recentTurns = state.recentTurns.slice(-Math.max(2, mode === "heavy" ? 6 : 3));
  const base = recentTurns.length / Math.max(1, mode === "heavy" ? 6 : 3);
  const topicBonus = state.conversationState.topicShiftDetected ? 0 : 0.18;
  return Math.max(0, Math.min(1, Number((base * 0.72 + topicBonus).toFixed(4))));
}
