/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 13-epistemic-integration-layer
 * Module: operators/claim-support-mapper
 * Responsibility: Map collapsed claims to supporting evidence snippets.
 * Primary Inputs: ProcessingState and layer mode.
 * Primary Outputs: Claim-support pairs.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: epistemic-integration-layer
 * Invariants: Mapping is lightweight and local.
 * Failure Modes: Empty claims degrade to an empty mapping.
 * Audit Events: claim_support_mapped
 * Notes: Supports explicit provenance without altering retrieval logic.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function claimSupportMapper(state: ProcessingState, mode: LayerMode) {
  const claims = state.collapsedTruth.summary ? [state.collapsedTruth.summary] : [];
  const support = state.retrievedEvidence.slice(0, mode === "heavy" ? 4 : 2);
  return claims.map((claim) => ({
    claim,
    supportingEvidence: support,
  }));
}
