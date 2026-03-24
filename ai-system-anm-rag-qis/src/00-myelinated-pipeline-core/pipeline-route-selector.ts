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
  isConversational: boolean;
  ambiguity: number;
  priorScore: number;
  verifiable: boolean;
  tokenCount: number;
  hasQuestion: boolean;
  quickIntent?: string;
  safetyAction?: string;
}): PipelineRoute {
  if (params.safetyAction === "caution") return "minimum";
  if (params.isConversational) return "minimum";
  if (params.quickIntent === "research" && params.verifiable) return "quantum-state";
  if (params.quickIntent === "research") return "inferential";
  if (params.verifiable || params.priorScore >= 0.72) return "quantum-state";
  if (params.quickIntent === "analysis") return "inferential";
  if (params.quickIntent === "technical") {
    if (params.tokenCount <= 5 && !params.hasQuestion) return "minimum";
    return "inferential";
  }
  if (params.priorScore >= 0.55 || params.ambiguity >= 0.52) return "inferential";
  if (params.priorScore >= 0.40 || params.ambiguity >= 0.34) return "reflective";
  return "minimum";
}

export function selectPipelineRoute(state: ProcessingState): PipelineRoute {
  const message = state.normalizedMessage || state.rawMessage;
  const focusedMessage = extractLatestUserUtterance(message) || message;
  const snapshot = state.textAnalysisSnapshot ?? buildTextAnalysisSnapshot(focusedMessage);
  state.textAnalysisSnapshot = snapshot;
  const preRoute = state.preRouteSignals;

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

  state.complexityProfile.score = score;
  state.complexityProfile.ambiguity = finalAmbiguity;

  const verifiable =
    !isNameRecallPrompt(focusedMessage) &&
    (snapshot.hasVerifiableSignal || Boolean(preRoute?.hasVerifiableSignal));

  return decideRoute({
    isConversational: conversational,
    ambiguity: finalAmbiguity,
    priorScore: score,
    verifiable,
    tokenCount: snapshot.tokenCount,
    hasQuestion: snapshot.questionCount > 0,
    quickIntent: preRoute?.quickIntent,
    safetyAction: preRoute?.safetyAction,
  });
}
