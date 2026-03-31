/**
 * Responsabilidade do arquivo:
 * - Inicializar ProcessingState com defaults operacionais do pipeline.
 * - Garantir executionPlan consistente desde o bootstrap.
 * - Aplicar metadados de sessao/turno de entrada.
 */
import { createInitialProcessingState, type ProcessingState } from "../bridges/contracts/processing-state";
import { buildTextAnalysisSnapshot } from "../shared/text-processing/text-analysis-snapshot";
import type { PipelineBootstrapInput } from "./pipeline-transition-contracts";

function sanitizeTimeZone(value: string | undefined): string {
  const candidate = `${value || ""}`.trim();
  if (!candidate) return "";
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return "";
  }
}

export function buildPipelineState(input: PipelineBootstrapInput): ProcessingState {
  const state = createInitialProcessingState(input.rawMessage);
  state.timings.pipelineStartedAt = Date.now();
  state.textAnalysisSnapshot = buildTextAnalysisSnapshot(input.rawMessage || "");
  state.preRouteSignals = {
    quickIntent: "chat",
    quickUrgency: "low",
    quickComplexity: 0,
    quickAmbiguity: 0,
    hasGreetingSignal: false,
    greetingFamily: "none",
    greetingConfidence: 0,
    greetingFastLaneEligible: false,
    greetingFastLaneReason: "no_greeting_family",
    hasVerifiableSignal: false,
    hasRecencySignal: false,
    hasSafetyRisk: false,
    safetyAction: "allow",
    tokenCount: 0,
    questionCount: 0,
  };
  state.executionArtifacts = {
    ...state.executionArtifacts,
    activeFamilies: [],
    knowledge: {
      cache: {},
      lastQuerySignature: "",
      lastUsedCache: false,
    },
  };
  state.observabilityMetrics = {
    routeMetrics: {},
    layerMetrics: {},
    skipReasons: {},
    fallbackStrategies: {},
    errorCategories: {},
    familyMetrics: {},
  };
  state.executionPlan.selectedRoute = "minimum";
  state.executionPlan.mode = "chat";
  state.executionPlan.steps = [];
  state.executionPlan.validationProfile = "light";
  state.executionPlan.pruningMode = "aggressive";

  if (input.sessionId) state.sessionState.sessionId = input.sessionId;
  if (input.turnId) state.sessionState.turnId = input.turnId;
  const userTimeZone = sanitizeTimeZone(input.userTimeZone);
  if (userTimeZone) {
    state.userProfile = {
      ...state.userProfile,
      timeZone: userTimeZone,
    };
  }
  if (Array.isArray(input.recentTurns)) state.recentTurns = input.recentTurns.slice(-12);
  return state;
}
