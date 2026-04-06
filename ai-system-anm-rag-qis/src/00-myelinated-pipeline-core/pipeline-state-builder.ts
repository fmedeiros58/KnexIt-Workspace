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

function sanitizeIdentityRuntimeLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    labels.push(trimmed);
    if (labels.length >= 8) break;
  }
  return labels;
}

function sanitizeIdentityRuntimeSource(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 64);
}

function parseIdentityRuntimeContext(input: PipelineBootstrapInput) {
  const raw = input.identityRuntimeContext;
  if (!raw || typeof raw !== "object") return null;

  const source = sanitizeIdentityRuntimeSource(raw.source);
  const recognizedLabels = sanitizeIdentityRuntimeLabels(raw.recognizedLabels);
  const founderDetected = raw.founderDetected === true;

  if (!source && !recognizedLabels.length && !founderDetected) return null;
  return {
    source: source || "identity_runtime_shared_memory",
    recognizedLabels,
    founderDetected,
  };
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
    intentGatePrimaryIntent: "react_socially",
    intentGateSecondaryIntents: [],
    intentGateMinimalDepth: "minimal",
    intentGateRoutingRecommendation: "lightweight_answer",
    intentGateResponseModeHint: "social",
    intentGateHasContextDependency: false,
    intentGateContextDependencyScore: 0,
    intentGateAmbiguityScore: 0,
    intentGateSemanticDensityScore: 0,
    intentGateShouldBypassDeepPipeline: false,
    intentGateShouldUseRecentConversationContext: false,
    intentGateShouldEscalateToDeepPipeline: false,
    intentGateConfidence: 0,
    intentGateReasoningTags: [],
    intentGateDebugTrace: [],
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

  const identityRuntimeContext = parseIdentityRuntimeContext(input);
  if (identityRuntimeContext) {
    state.userProfile = {
      ...state.userProfile,
      identityRuntimeContext,
    };
    state.activeContext = [
      ...state.activeContext,
      ...identityRuntimeContext.recognizedLabels.map((label) => `identity_runtime_label:${label}`),
      `identity_runtime_source:${identityRuntimeContext.source}`,
      ...(identityRuntimeContext.founderDetected ? ["identity_runtime_founder:medeiros"] : []),
    ].slice(-24);
  }
  return state;
}
