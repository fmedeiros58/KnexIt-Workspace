/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 17f-response-calibration-layer
 * Module: operators/calibration-depth-resolver
 * Responsibility: Resolve the effective calibration depth and density policy for the final response surface.
 * Primary Inputs: ProcessingState and response-calibration layer mode.
 * Primary Outputs: Calibration depth policy.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: response-calibration-layer-bridge
 * Invariants: Calibration only shapes the already validated surface; it does not replace the response plan.
 * Failure Modes: Missing adaptive signals fall back to the delivery profile defaults.
 * Audit Events: calibration_depth_resolved
 * Notes: This operator keeps density and closing heuristics local to layer 17f.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export interface CalibrationDepthPolicy {
  density: "compact" | "balanced" | "detailed";
  forceDetailed: boolean;
  preserveClosingQuestion: boolean;
  rationale: string[];
}

export function calibrationDepthResolver(
  state: ProcessingState,
  mode: LayerMode,
): CalibrationDepthPolicy {
  const budgetClass = `${state.adaptivePipelineContract?.budgetClass || ""}`.toLowerCase();
  const complex = Math.max(state.complexityProfile.score || 0, state.preRouteSignals.quickComplexity || 0) >= 0.45;
  const questionDense = (state.preRouteSignals.questionCount || 0) >= 2;
  const preserveClosingQuestion = state.proactivityDecisionState.allowProactivity;

  if (mode === "delivery-light" || mode === "light" || budgetClass === "tight") {
    return {
      density: "compact",
      forceDetailed: false,
      preserveClosingQuestion,
      rationale: ["calibration_compact_mode"],
    };
  }

  if (mode === "delivery-rich" || mode === "heavy" || budgetClass === "expanded" || complex || questionDense) {
    return {
      density: "detailed",
      forceDetailed: true,
      preserveClosingQuestion,
      rationale: ["calibration_detailed_mode"],
    };
  }

  return {
    density: "balanced",
    forceDetailed: false,
    preserveClosingQuestion,
    rationale: ["calibration_balanced_mode"],
  };
}
