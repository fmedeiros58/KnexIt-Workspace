import type { CollapsedTruth } from "../../shared/types/common-types";
import type { QuantumHypothesis } from "../quantum-core-types";
import { applyConfidenceThreshold } from "./confidence-threshold-gate";
import { determineEpistemicStatus } from "./epistemic-status-annotator";
import { selectFinalValidity } from "./final-validity-selector";
import { preserveUncertainty } from "./uncertainty-preservation-controller";

function normalizeWeights(hypotheses: QuantumHypothesis[]) {
  const total = hypotheses.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (total <= 0) {
    const uniform = hypotheses.length ? 1 / hypotheses.length : 0;
    return Object.fromEntries(hypotheses.map((item) => [item.id, uniform]));
  }
  return Object.fromEntries(hypotheses.map((item) => [item.id, Number((Math.max(0, item.weight) / total).toFixed(6))]));
}

export function runTruthCollapse(input: {
  hypotheses: QuantumHypothesis[];
  ambiguity: number;
}): {
  collapsedTruth: CollapsedTruth;
  normalizedWeights: Record<string, number>;
  confidence: number;
  converged: boolean;
} {
  const normalizedWeights = normalizeWeights(input.hypotheses);
  const dominant = selectFinalValidity(input.hypotheses);
  const confidenceRaw = dominant ? normalizedWeights[dominant.id] ?? dominant.weight : 0;
  const confidence = applyConfidenceThreshold(confidenceRaw);
  const contradictionCount = dominant?.contradictorySources.length || 0;
  const sourceCount = dominant?.supportingSources.length || 0;
  const uncertainty = preserveUncertainty(confidence, input.ambiguity);
  const status = determineEpistemicStatus({
    confidence,
    uncertainty,
    sourceCount,
    contradictionCount,
  });

  return {
    collapsedTruth: {
      summary: dominant?.claim || "Sem hipotese dominante.",
      dominantHypothesisId: dominant?.id || null,
      status,
      uncertainty,
    },
    normalizedWeights,
    confidence,
    converged: confidence >= 0.5,
  };
}
