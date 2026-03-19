/**
 * Responsabilidade do arquivo:
 * - Inicializar ProcessingState com defaults operacionais do pipeline.
 * - Garantir executionPlan consistente desde o bootstrap.
 * - Aplicar metadados de sessao/turno de entrada.
 */
import { createInitialProcessingState, type ProcessingState } from "../bridges/contracts/processing-state";
import { buildTextAnalysisSnapshot } from "../shared/text-processing/text-analysis-snapshot";
import type { PipelineBootstrapInput } from "./pipeline-transition-contracts";

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
  if (Array.isArray(input.recentTurns)) state.recentTurns = input.recentTurns.slice(-12);
  return state;
}
