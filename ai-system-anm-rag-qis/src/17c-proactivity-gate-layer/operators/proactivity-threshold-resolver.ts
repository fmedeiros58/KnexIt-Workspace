/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 17c-proactivity-gate-layer
 * Module: operators/proactivity-threshold-resolver
 * Responsibility: Resolve local thresholds for proactivity gating from state and adaptive mode.
 * Primary Inputs: ProcessingState and proactivity-gate layer mode.
 * Primary Outputs: Proactivity threshold policy.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: proactivity-gate-layer-bridge
 * Invariants: Threshold resolution never enables proactivity when the gate already blocks it structurally.
 * Failure Modes: Missing policy signals degrade to conservative thresholds.
 * Audit Events: proactivity_thresholds_resolved
 * Notes: This operator converts adaptive orchestration signals into a local gate policy.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export interface ProactivityThresholdPolicy {
  maxInterruptionRisk: number;
  minRelevanceScore: number;
  rationale: string[];
}

export function proactivityThresholdResolver(
  state: ProcessingState,
  mode: LayerMode,
): ProactivityThresholdPolicy {
  const policy = `${state.adaptivePipelineContract?.proactivityPolicy || state.proactivityMode || ""}`.toLowerCase();
  const caution = state.affectiveState.cautionLevel || 0;

  if (policy === "low" || mode === "light" || mode === "delivery-light") {
    return {
      maxInterruptionRisk: 0.36 - Math.min(0.08, caution * 0.08),
      minRelevanceScore: 0.56,
      rationale: ["proactivity_conservative_mode"],
    };
  }

  if (policy === "high" || mode === "heavy" || mode === "required") {
    return {
      maxInterruptionRisk: 0.52 - Math.min(0.06, caution * 0.05),
      minRelevanceScore: 0.4,
      rationale: ["proactivity_expansive_mode"],
    };
  }

  return {
    maxInterruptionRisk: 0.46 - Math.min(0.06, caution * 0.06),
    minRelevanceScore: 0.46,
    rationale: ["proactivity_balanced_mode"],
  };
}
