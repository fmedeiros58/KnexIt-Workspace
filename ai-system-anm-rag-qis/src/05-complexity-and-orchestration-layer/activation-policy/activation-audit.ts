/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: activation-policy/activation-audit
 * Responsibility: Summarize resolved layer activation decisions for audit and observability.
 * Primary Inputs: LayerActivationMap
 * Primary Outputs: Structured activation audit payloads.
 * Upstream Dependencies: bridges/contracts/layer-activation
 * Downstream Dependencies: orchestration-layer, observability
 * Invariants: Audit output is compact and serializable.
 * Failure Modes: Empty maps produce an empty summary instead of throwing.
 * Audit Events: layer_activation_audited
 * Notes: The summary is used by orchestrator audit records and execution artifacts.
 */
import type { LayerActivationMap } from "../../bridges/contracts/layer-activation";

export function summarizeLayerActivations(layerActivations: LayerActivationMap): Record<string, string> {
  return Object.fromEntries(
    Object.entries(layerActivations).map(([layer, activation]) => [layer, activation?.mode || "medium"]),
  );
}
