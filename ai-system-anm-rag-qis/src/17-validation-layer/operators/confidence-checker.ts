/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 17-validation-layer
 * Module: operators/confidence-checker
 * Responsibility: Resolve confidence acceptance floors for the validation layer.
 * Primary Inputs: ProcessingState and validation layer mode.
 * Primary Outputs: Confidence checking policy.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: validation-layer-bridge
 * Invariants: Confidence floors tighten under high-risk or epistemically heavy execution modes.
 * Failure Modes: Missing signals fall back to conservative mid-range thresholds.
 * Audit Events: validation_confidence_policy_resolved
 * Notes: This operator lets validation escalate retry decisions without changing the descending flow.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export interface ConfidenceCheckPolicy {
  minimumAcceptScore: number;
  minimumCoherence: number;
  minimumEpistemic: number;
  retryOnStructureFailure: boolean;
  rationale: string[];
}

export function confidenceChecker(
  state: ProcessingState,
  mode: LayerMode,
): ConfidenceCheckPolicy {
  const strictMode = mode === "heavy" || mode === "required" || mode === "epistemic-heavy";
  const uncertainty = Number.isFinite(state.collapsedTruth.uncertainty) ? state.collapsedTruth.uncertainty : 1;
  const caution = state.affectiveState.cautionLevel || 0;
  const riskLevel = `${state.adaptivePipelineContract?.riskLevel || ""}`.toLowerCase();

  const minimumAcceptScore = strictMode || riskLevel === "high"
    ? 0.72
    : uncertainty >= 0.5 || caution >= 0.65
      ? 0.66
      : 0.58;

  return {
    minimumAcceptScore,
    minimumCoherence: strictMode ? 0.64 : 0.54,
    minimumEpistemic: strictMode ? 0.58 : 0.48,
    retryOnStructureFailure: strictMode || riskLevel === "high",
    rationale: [
      strictMode ? "confidence_strict_mode" : "confidence_standard_mode",
      ...(uncertainty >= 0.5 ? ["high_uncertainty"] : []),
      ...(caution >= 0.65 ? ["high_caution"] : []),
      ...(riskLevel === "high" ? ["adaptive_risk_high"] : []),
    ],
  };
}
