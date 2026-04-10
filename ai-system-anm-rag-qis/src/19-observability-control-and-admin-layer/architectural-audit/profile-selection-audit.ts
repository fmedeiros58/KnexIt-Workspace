/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 19-observability-control-and-admin-layer
 * Module: architectural-audit/profile-selection-audit
 * Responsibility: Summarize selected execution profiles for observability.
 * Primary Inputs: ProcessingState
 * Primary Outputs: Serializable profile selection summary
 * Upstream Dependencies: bridges/contracts/processing-state
 * Downstream Dependencies: observability-layer
 * Invariants: Read-only summary over typed profile selection state.
 * Failure Modes: Missing selection returns null.
 * Audit Events: profile_selection_audited
 * Notes: Used by the observability layer to expose orchestration decisions.
 */
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function buildProfileSelectionAudit(state: ProcessingState) {
  if (!state.profileSelectionResult) return null;
  return {
    primaryProfileId: state.profileSelectionResult.primaryProfileId,
    selectedProfileIds: state.profileSelectionResult.selectedProfileIds,
    weights: state.profileSelectionResult.weights,
    dominantSignals: state.profileSelectionResult.dominantSignals,
  };
}
