/**
 * Responsabilidade do arquivo:
 * - Selecionar rota inicial combinando snapshot textual e preRouteSignals.
 * - Consolidar score/ambiguidade iniciais para roteamento consistente.
 * - Reduzir risco em casos de safety com queda imediata para rota minima.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import type { PipelineRoute } from "../shared/enums/pipeline-enums";
import { buildTextAnalysisSnapshot } from "../shared/text-processing/text-analysis-snapshot";
import {
  extractLatestUserUtterance,
  isConversationalPrompt,
  isNameRecallPrompt,
} from "../shared/utils/conversation-signals";
import {
  hasIntentGateEvaluation,
  resolveIntentGateRoute,
} from "../shared/routing/intent-gate-route-resolver";
import { argumentativeDepthDetector } from "../05b-deliberative-task-contract-layer/argumentative-depth-detector";
import { classifyCognitiveDemand } from "../05b-deliberative-task-contract-layer/cognitive-demand-classifier";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function estimateLexicalComplexityFromSnapshot(snapshot: ReturnType<typeof buildTextAnalysisSnapshot>) {
  const tokenFactor = clamp01(snapshot.tokenCount / 42);
  const connectiveFactor = clamp01(snapshot.connectiveCount / 5);
  const punctuationFactor = clamp01(snapshot.punctuationCount / 6);
  const longTokenFactor = clamp01(snapshot.longTokenRatio * 1.6);
  const questionFactor = snapshot.questionCount > 1 ? 0.08 : 0;

  return clamp01(
    (tokenFactor * 0.45) +
    (connectiveFactor * 0.20) +
    (punctuationFactor * 0.15) +
    (longTokenFactor * 0.20) +
    questionFactor,
  );
}

function estimateAmbiguityFromSnapshot(snapshot: ReturnType<typeof buildTextAnalysisSnapshot>) {
  const shortMessagePenalty = snapshot.tokenCount < 5 ? 0.12 : 0;
  return clamp01(
    (snapshot.ambiguousTermCount * 0.16) +
    (snapshot.pronounCount * 0.06) +
    shortMessagePenalty,
  );
}

function decideRoute(params: {
  safetyAction?: string;
}): PipelineRoute {
  if (params.safetyAction === "caution") return "minimum";
  return "inferential";
}

function routeRank(route: PipelineRoute): number {
  return route === "minimum" ? 0 : 1;
}

function elevateRoute(current: PipelineRoute, floor: PipelineRoute): PipelineRoute {
  return routeRank(current) >= routeRank(floor) ? current : floor;
}

export function selectPipelineRoute(state: ProcessingState): PipelineRoute {
  const message = state.normalizedMessage || state.rawMessage;
  const focusedMessage = extractLatestUserUtterance(message) || message;
  const snapshot = state.textAnalysisSnapshot ?? buildTextAnalysisSnapshot(focusedMessage);
  state.textAnalysisSnapshot = snapshot;
  const preRoute = state.preRouteSignals;
  const logicalFrame = state.logicalFrame;
  const deliberativeDepth = argumentativeDepthDetector(focusedMessage);
  const demandProfile = classifyCognitiveDemand(focusedMessage);

  const conversational =
    isConversationalPrompt(focusedMessage) ||
    snapshot.hasGreetingSignal ||
    Boolean(preRoute?.hasGreetingSignal);

  const lexicalScore = estimateLexicalComplexityFromSnapshot(snapshot);
  const ambiguity = estimateAmbiguityFromSnapshot(snapshot);

  const scoreSeed = Math.max(
    state.complexityProfile.score || 0,
    lexicalScore,
    preRoute?.quickComplexity || 0,
  );

  const ambiguitySeed = Math.max(
    state.complexityProfile.ambiguity || 0,
    ambiguity,
    preRoute?.quickAmbiguity || 0,
  );

  const score = conversational ? Math.min(scoreSeed, 0.28) : scoreSeed;
  const finalAmbiguity = conversational ? Math.min(ambiguitySeed, 0.22) : ambiguitySeed;

  const logicalBias = logicalFrame?.shouldAffectRouting ? Math.max(0, logicalFrame.confidence * 0.18) : 0;
  const deliberativeBias = deliberativeDepth.requiresDeliberativeContract
    ? Math.max(0.16, deliberativeDepth.argumentativeDepthScore * 0.28)
    : 0;
  const demandBias = demandProfile.requiresDeliberativeContract
    ? Math.max(0.12, demandProfile.reasoningIntensity * 0.22)
    : 0;
  state.complexityProfile.score = clamp01(score + logicalBias + deliberativeBias + demandBias);
  state.complexityProfile.ambiguity = finalAmbiguity;

  const verifiable =
    !isNameRecallPrompt(focusedMessage) &&
    (snapshot.hasVerifiableSignal || Boolean(preRoute?.hasVerifiableSignal));

  if (preRoute?.greetingFastLaneEligible) return "minimum";
  if (preRoute?.safetyAction === "caution") return "minimum";
  if (deliberativeDepth.requiresDeliberativeContract || demandProfile.requiresDeliberativeContract) return "inferential";
  if (logicalFrame?.shouldAffectRouting) return "inferential";

  const intentGateRoute = resolveIntentGateRoute({
    routingRecommendation: preRoute?.intentGateRoutingRecommendation,
    shouldEscalateToDeepPipeline: preRoute?.intentGateShouldEscalateToDeepPipeline,
    hasVerifiableSignal: verifiable,
  });
  const hasIntentGateEvaluationSignal = hasIntentGateEvaluation({
    intentGateConfidence: preRoute?.intentGateConfidence,
    intentGateDebugTrace: preRoute?.intentGateDebugTrace,
  });

  const decidedRoute = decideRoute({
    safetyAction: preRoute?.safetyAction,
  });

  return hasIntentGateEvaluationSignal && intentGateRoute
    ? elevateRoute(decidedRoute, intentGateRoute)
    : decidedRoute;
}
