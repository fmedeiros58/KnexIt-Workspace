/**
 * ANM ARCHITECTURAL SPEC
 * Layer: bridges/contracts
 * Module: profile-selection-result
 * Responsibility: Describe the audit-friendly outcome of adaptive profile selection.
 * Primary Inputs: Motor routing analysis, heuristic fusion, execution profile catalog.
 * Primary Outputs: ProfileSelectionResult.
 * Upstream Dependencies: bridges/contracts/execution-profile
 * Downstream Dependencies: activation-policy, adaptive contract builder, observability
 * Invariants: The selection result is deterministic for a given fused analysis snapshot.
 * Failure Modes: Empty selection must degrade to conversational-light-profile.
 * Audit Events: profile_selection_resolved, profile_selection_fallback
 * Notes: Weights are normalized to [0,1] and keyed by profile id.
 */
export interface ProfileSelectionResult {
  primaryProfileId: string;
  selectedProfileIds: string[];
  weights: Record<string, number>;
  reasons: string[];
  dominantSignals: string[];
  catalogVersion: string;
}
