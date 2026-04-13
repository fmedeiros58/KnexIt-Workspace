/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 17f-response-calibration-layer
 * Module: operators/response-commitment-regulator
 * Responsibility: Regulate over-commitment in the final calibrated response using local uncertainty signals.
 * Primary Inputs: ProcessingState, response-calibration layer mode and candidate output text.
 * Primary Outputs: Commitment-regulated text.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: response-calibration-layer-bridge
 * Invariants: The operator only softens commitment markers when local uncertainty is meaningfully elevated.
 * Failure Modes: Missing signals leave the text unchanged.
 * Audit Events: response_commitment_regulated
 * Notes: This is a calibration-side operator, not a reasoning-stage rewrite.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export interface ResponseCommitmentResult {
  text: string;
  softened: boolean;
  reasons: string[];
}

const SOFTENING_RULES: ReadonlyArray<[RegExp, string]> = [
  [/\bcom certeza\b/gi, "ao que tudo indica"],
  [/\bcertamente\b/gi, "com boa probabilidade"],
  [/\bsem duvida\b/gi, "com forte indicio"],
  [/\bsempre\b/gi, "em geral"],
  [/\bnunca\b/gi, "raramente"],
];

export function responseCommitmentRegulator(
  state: ProcessingState,
  mode: LayerMode,
  text: string,
): ResponseCommitmentResult {
  const value = `${text || ""}`.trim();
  if (!value) {
    return {
      text: value,
      softened: false,
      reasons: ["empty_response"],
    };
  }

  const highUncertainty = state.collapsedTruth.uncertainty >= 0.48;
  const factualRisk = !state.validationReport.factual.ok || state.validationReport.quality.score < 0.7;
  const shouldSoften = highUncertainty || factualRisk || mode === "epistemic-heavy";
  if (!shouldSoften) {
    return {
      text: value,
      softened: false,
      reasons: ["commitment_within_bounds"],
    };
  }

  let regulated = value;
  for (const [pattern, replacement] of SOFTENING_RULES) {
    regulated = regulated.replace(pattern, replacement);
  }

  return {
    text: regulated.trim(),
    softened: regulated.trim() !== value,
    reasons: [
      highUncertainty ? "uncertainty_high" : "uncertainty_controlled",
      factualRisk ? "validation_risk_present" : "validation_risk_controlled",
    ],
  };
}
