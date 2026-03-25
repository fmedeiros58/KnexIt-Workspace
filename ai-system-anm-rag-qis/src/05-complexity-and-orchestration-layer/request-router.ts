/**
 * Responsabilidade do arquivo:
 * - Derivar route hint de alto nivel para a orchestracao.
 * - Combinar sinais de preRouteScan, complexidade e verificabilidade.
 * - Evitar rotas profundas em situacoes de risco/safety.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import type { PipelineRoute } from "../shared/enums/pipeline-enums";

const THRESHOLDS = {
  inferentialScore: 0.50,
  inferentialAmbiguity: 0.48,
  reflectiveScore: 0.36,
  quantumVerifiableScore: 0.55,
};

export function routeRequest(state: ProcessingState): PipelineRoute {
  const intent = state.inputSignals.intent || state.preRouteSignals?.quickIntent || "chat";
  const urgency = state.inputSignals.urgency || state.preRouteSignals?.quickUrgency || "low";
  const safetyFlags = state.inputSignals.safetyFlags || [];
  const score = state.complexityProfile.score || state.preRouteSignals?.quickComplexity || 0;
  const ambiguity = state.complexityProfile.ambiguity || state.preRouteSignals?.quickAmbiguity || 0;
  const snapshot = state.textAnalysisSnapshot;
  const hasVerifiableSignal = snapshot?.hasVerifiableSignal || Boolean(state.preRouteSignals?.hasVerifiableSignal);
  const hasSafetyRestriction =
    state.preRouteSignals?.safetyAction === "caution" ||
    safetyFlags.some((flag) => /block|malicious|prompt_injection|harmful/i.test(flag));

  if (hasSafetyRestriction) return "minimum";
  if (hasVerifiableSignal && score >= THRESHOLDS.quantumVerifiableScore) return "quantum-state";
  if (intent === "research") return "quantum-state";
  if (intent === "analysis" || intent === "technical") return "inferential";
  if (ambiguity >= THRESHOLDS.inferentialAmbiguity || score >= THRESHOLDS.inferentialScore) return "inferential";
  if (score >= THRESHOLDS.reflectiveScore || urgency === "medium") return "reflective";
  return "minimum";
}
