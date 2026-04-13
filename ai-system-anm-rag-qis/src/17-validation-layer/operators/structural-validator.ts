/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 17-validation-layer
 * Module: operators/structural-validator
 * Responsibility: Resolve structural validation intensity from the current state and adaptive layer mode.
 * Primary Inputs: ProcessingState and validation layer mode.
 * Primary Outputs: Structural validation policy.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: validation-layer-bridge
 * Invariants: The operator is local to validation and does not mutate the global state.
 * Failure Modes: Missing structural signals degrade to a safe standard policy.
 * Audit Events: structural_validation_policy_resolved
 * Notes: This operator modulates structural strictness without bypassing the validation layer.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export interface StructuralValidationPolicy {
  structuralProfile: "minimal" | "standard" | "strict";
  enforceSequence: boolean;
  enforceTruncation: boolean;
  enforceCompletion: boolean;
  enforceParagraphCohesion: boolean;
  rationale: string[];
}

export function structuralValidator(
  state: ProcessingState,
  mode: LayerMode,
): StructuralValidationPolicy {
  const response = `${state.structuredResponse || state.validatedDraft || state.reasonedDraft || ""}`.trim();
  const expectsStructuredOutput =
    state.adaptivePipelineContract?.expectedOutputShape.some((shape) =>
      ["outline", "steps", "analysis", "report", "comparison"].includes(shape),
    ) || false;
  const longFormSignal = response.length >= 700 || state.longFormDiscourseState.isActive;
  const strictMode = mode === "heavy" || mode === "required" || mode === "epistemic-heavy";
  const minimalMode = mode === "light" || mode === "delivery-light";

  const structuralProfile = strictMode ? "strict" : minimalMode ? "minimal" : "standard";
  return {
    structuralProfile,
    enforceSequence: strictMode || expectsStructuredOutput,
    enforceTruncation: true,
    enforceCompletion: !minimalMode || longFormSignal,
    enforceParagraphCohesion: strictMode || longFormSignal,
    rationale: [
      strictMode ? "validation_mode_strict" : minimalMode ? "validation_mode_light" : "validation_mode_standard",
      ...(expectsStructuredOutput ? ["expected_structured_output"] : []),
      ...(longFormSignal ? ["long_form_signal"] : []),
    ],
  };
}
