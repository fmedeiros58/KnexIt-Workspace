/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 04-context-and-session-layer
 * Module: operators/session-operating-mode-tracker
 * Responsibility: Track session-level operating mode drift.
 * Primary Inputs: ProcessingState and layer mode.
 * Primary Outputs: Session operating mode summary.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: context-layer
 * Invariants: Tracking is recommendation-only and deterministic.
 * Failure Modes: Missing inputs degrade to current selected mode.
 * Audit Events: session_operating_mode_tracked
 * Notes: Useful when adaptive profiles shift the session style over time.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function sessionOperatingModeTracker(state: ProcessingState, mode: LayerMode) {
  const operatingMode = `${state.selectedMode}:${mode}`;
  return {
    operatingMode,
    changed: !state.activeContext.some((item) => item === `session_mode:${operatingMode}`),
  };
}
