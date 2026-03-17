import type { ProcessingState } from "../bridges/contracts/processing-state";
import type { LanguageToConversationPayload } from "../02-language-layer/types/language-payload-types";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { turnManager } from "./turn-management-core/turn-manager";
import { topicTracker } from "./dialogue-state-core/topic-tracker";
import { clarificationStrategyEngine } from "./interaction-strategy-core/clarification-strategy-engine";
import { rapportManager } from "./social-conversation-core/rapport-manager";
import { questionAskingEngine } from "./conversational-skill-core/question-asking-engine";
import { handoffConversationToContext } from "./conversation-to-context-bridge";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function readLanguageHandoff(state: ProcessingState): LanguageToConversationPayload | null {
  const raw = (state.userProfile as Record<string, unknown>).languageHandoff;
  if (!raw || typeof raw !== "object") return null;

  const payload = raw as Partial<LanguageToConversationPayload>;
  if (
    typeof payload.stabilizedText !== "string" ||
    typeof payload.consolidatedLanguage !== "string" ||
    typeof payload.speechAct !== "string"
  ) {
    return null;
  }

  return {
    stabilizedText: payload.stabilizedText,
    consolidatedLanguage: payload.consolidatedLanguage,
    speechAct: payload.speechAct,
    pragmaticIntent: typeof payload.pragmaticIntent === "string" ? payload.pragmaticIntent : "unknown",
    referentialMarkers: Array.isArray(payload.referentialMarkers) ? payload.referentialMarkers : [],
    ambiguitySignals: Array.isArray(payload.ambiguitySignals) ? payload.ambiguitySignals : [],
    repetitionDetected: Boolean(payload.repetitionDetected),
    emotionalTone: typeof payload.emotionalTone === "string" ? payload.emotionalTone : "calm",
    urgency: payload.urgency === "high" || payload.urgency === "medium" ? payload.urgency : "low",
    discourseRepairSignals: Array.isArray(payload.discourseRepairSignals) ? payload.discourseRepairSignals : [],
  };
}

function resolveClarificationAmbiguity(baseAmbiguity: number, handoff: LanguageToConversationPayload | null): number {
  if (!handoff) return baseAmbiguity;
  const handoffBoost =
    Math.min(0.24, handoff.ambiguitySignals.length * 0.06) +
    (handoff.discourseRepairSignals.length > 0 ? 0.08 : 0) +
    (handoff.repetitionDetected ? 0.08 : 0);
  return clamp01(baseAmbiguity + handoffBoost);
}

export async function runConversationLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const handoff = readLanguageHandoff(state);
  const text = handoff?.stabilizedText || state.normalizedMessage || state.rawMessage;
  const ambiguity = resolveClarificationAmbiguity(state.languageState.ambiguity, handoff);
  const effectiveTone = handoff?.emotionalTone === "frustrated" ? "direct" : state.languageState.tone;

  const turns = turnManager({ recentTurns: state.recentTurns });
  const topic = topicTracker({
    text,
    fallbackTopic: state.conversationState.activeTopic,
  });
  const clarification = clarificationStrategyEngine({
    ambiguity,
    text,
  });
  const rapport = rapportManager({
    politeness: state.languageState.politeness,
    tone: effectiveTone,
    emotionalTone: handoff?.emotionalTone,
    urgency: handoff?.urgency || state.inputSignals.urgency,
  });
  const followUp = questionAskingEngine({
    needsClarification: clarification.needsClarification,
    strategy: clarification.strategy,
  });

  state.conversationState = {
    turnCount: turns.turnCount,
    balanceScore: turns.balanceScore,
    activeTopic: topic.topic,
    topicShiftDetected: topic.shiftDetected,
    needsClarification: clarification.needsClarification,
    clarificationStrategy: clarification.strategy,
    followUpPrompt: followUp.followUpPrompt,
    rapportScore: rapport.rapportScore,
  };

  state.activeContext = [
    ...state.activeContext,
    `conversation_topic:${topic.topic}`,
    ...(handoff ? [`conversation_handoff_speech_act:${handoff.speechAct}`] : []),
    ...(handoff ? [`conversation_handoff_intent:${handoff.pragmaticIntent}`] : []),
    ...(handoff?.repetitionDetected ? ["conversation_repetition_signal"] : []),
    ...(handoff?.discourseRepairSignals.length ? ["conversation_repair_signal"] : []),
    ...(topic.shiftDetected ? ["conversation_topic_shift_detected"] : []),
    ...(followUp.followUpPrompt ? [`conversation_followup:${followUp.followUpPrompt}`] : []),
  ].slice(-16);

  state.trace.push(
    makeTraceEvent({
      layer: "conversation",
      action: "conversation_state_updated",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `topic=${topic.topic}; turnCount=${turns.turnCount}; clarify=${clarification.needsClarification}; rapport=${rapport.rapportScore.toFixed(2)}; handoff=${handoff ? "yes" : "no"}`,
    }),
  );

  return handoffConversationToContext(state);
}
