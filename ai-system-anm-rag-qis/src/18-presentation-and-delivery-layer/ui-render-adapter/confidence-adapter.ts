import { clamp01 } from "../presentation-contracts";
import type { ConfidenceBand, ConfidenceView } from "../presentation-contracts";
import type { ConfidenceScores } from "../../shared/types/common-types";
import type { ValidationReport } from "../../bridges/contracts/processing-state";

export interface ConfidenceAdapterInput {
  scores: ConfidenceScores;
  validationReport: ValidationReport;
}

export interface ConfidenceAdapterOutput {
  ok: boolean;
  component: string;
  score: number;
  confidence: ConfidenceView;
}

function resolveBand(value: number): ConfidenceBand {
  if (value >= 0.78) return "high";
  if (value >= 0.52) return "medium";
  return "low";
}

function resolveLabel(band: ConfidenceBand): string {
  if (band === "high") return "Confianca alta";
  if (band === "medium") return "Confianca moderada";
  return "Confianca baixa";
}

export function confidenceAdapter(input: ConfidenceAdapterInput): ConfidenceAdapterOutput {
  const epistemic = clamp01(input.scores.epistemic);
  const retrieval = clamp01(input.scores.retrieval);
  const coherence = clamp01(input.scores.coherence);
  const qualityScore = clamp01((input.validationReport.quality?.score || 0) / 100);
  const weighted = clamp01(epistemic * 0.35 + retrieval * 0.25 + coherence * 0.25 + qualityScore * 0.15);
  const band = resolveBand(weighted);

  const confidence: ConfidenceView = {
    score: weighted,
    band,
    label: resolveLabel(band),
    qualityDecision: input.validationReport.quality?.decision || "retry",
  };

  return {
    ok: true,
    component: "confidence-adapter",
    score: Math.max(0.45, weighted),
    confidence,
  };
}
