/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 19-observability-control-and-admin-layer
 * Module: architectural-audit/layer-activation-audit
 * Responsibility: Summarize the resolved layer activation matrix for observability.
 * Primary Inputs: ProcessingState
 * Primary Outputs: Serializable activation summary
 * Upstream Dependencies: bridges/contracts/processing-state
 * Downstream Dependencies: observability-layer
 * Invariants: Read-only summary over the adaptive contract layer activations.
 * Failure Modes: Missing adaptive contract returns null.
 * Audit Events: layer_activation_audited
 * Notes: Helps explain why layers were light, heavy or intelligently skipped.
 */
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function buildLayerActivationAudit(state: ProcessingState) {
  if (!state.adaptivePipelineContract) return null;
  return Object.fromEntries(
    Object.entries(state.adaptivePipelineContract.layerActivations).map(([layer, activation]) => [
      layer,
      activation?.mode || "medium",
    ]),
  );
}
