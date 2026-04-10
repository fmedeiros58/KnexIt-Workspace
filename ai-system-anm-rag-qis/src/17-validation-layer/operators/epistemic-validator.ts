/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 17-validation-layer
 * Module: operators/epistemic-validator
 * Responsibility: Resolve epistemic validation intensity and acceptance thresholds for the current turn.
 * Primary Inputs: ProcessingState and validation layer mode.
 * Primary Outputs: Epistemic validation policy.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: validation-layer-bridge
 * Invariants: The operator only configures epistemic checks; it does not validate content by itself.
 * Failure Modes: Missing evidence signals degrade to conservative defaults.
 * Audit Events: epistemic_validation_policy_resolved
 * Notes: This keeps epistemic strictness local to validation while still consuming adaptive orchestration signals.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export interface EpistemicValidationPolicy {
  shouldRunClaimCheck: boolean;
  shouldRunSourceAlignment: boolean;
  shouldRunUnsupportedStatementCheck: boolean;
  shouldRunHypothesisTrace: boolean;
  maxHallucinationRisk: number;
  rationale: string[];
}

export function epistemicValidator(
  state: ProcessingState,
  mode: LayerMode,
): EpistemicValidationPolicy {
  const strictMode = mode === "heavy" || mode === "required" || mode === "epistemic-heavy";
  const minimalMode = mode === "light" || mode === "delivery-light";
  const evidenceLight = state.retrievedSources.length === 0 && state.retrievedEvidence.length === 0;
  const validationPolicy = `${state.adaptivePipelineContract?.validationPolicy || ""}`.toLowerCase();
  const researchLikeMode = state.selectedMode === "research" || state.selectedMode === "analysis";

  return {
    shouldRunClaimCheck: strictMode || researchLikeMode || !minimalMode,
    shouldRunSourceAlignment: strictMode || state.retrievedSources.length > 0,
    shouldRunUnsupportedStatementCheck: !minimalMode || strictMode,
    shouldRunHypothesisTrace: strictMode && state.hypothesisSet.length > 1,
    maxHallucinationRisk:
      validationPolicy === "strict"
        ? 0.5
        : strictMode
          ? 0.55
          : evidenceLight
            ? 0.62
            : 0.68,
    rationale: [
      strictMode ? "epistemic_mode_strict" : minimalMode ? "epistemic_mode_light" : "epistemic_mode_standard",
      ...(researchLikeMode ? ["research_like_request"] : []),
      ...(validationPolicy === "strict" ? ["adaptive_validation_strict"] : []),
      ...(evidenceLight ? ["evidence_light_state"] : []),
    ],
  };
}
