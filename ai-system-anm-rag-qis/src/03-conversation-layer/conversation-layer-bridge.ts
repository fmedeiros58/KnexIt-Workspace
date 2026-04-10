/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 03-conversation-layer
 * Module: conversation-layer-bridge
 * Responsibility: Consolidate conversational state and resolve local carryover/topic operators before context handoff.
 * Primary Inputs: ProcessingState and language-to-conversation handoff.
 * Primary Outputs: Updated ConversationState, local conversational audit artifacts and context handoff.
 * Upstream Dependencies: language layer, local conversation operators
 * Downstream Dependencies: context/session layer
 * Invariants: Conversation logic stays local; it does not perform orchestration or final generation.
 * Failure Modes: Missing handoff data degrades to current turn heuristics.
 * Audit Events: conversation_state_updated
 * Notes: Local operators reduce topic bleed and improve continuity decisions without breaking the descending pipeline.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import type { LanguageToConversationPayload } from "../02-language-layer/types/language-payload-types";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { resolveLayerModeFromState } from "../05-complexity-and-orchestration-layer/activation-policy/layer-mode-resolver";
import { turnManager } from "./turn-management-core/turn-manager";
import { topicTracker } from "./dialogue-state-core/topic-tracker";
import { clarificationStrategyEngine } from "./interaction-strategy-core/clarification-strategy-engine";
import { rapportManager } from "./social-conversation-core/rapport-manager";
import { questionAskingEngine } from "./conversational-skill-core/question-asking-engine";
import { handoffConversationToContext } from "./conversation-to-context-bridge";
import { topicShiftDetector } from "./operators/topic-shift-detector";
import { continuityScorer } from "./operators/continuity-scorer";
import { carryoverPolicy } from "./operators/carryover-policy";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function repairCommonMojibake(value: string): string {
  return `${value || ""}`
    .replace(/Ã¡/g, "á")
    .replace(/Ã /g, "à")
    .replace(/Ã¢/g, "â")
    .replace(/Ã£/g, "ã")
    .replace(/Ã¤/g, "ä")
    .replace(/Ã©/g, "é")
    .replace(/Ã¨/g, "è")
    .replace(/Ãª/g, "ê")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ã´/g, "ô")
    .replace(/Ãµ/g, "õ")
    .replace(/Ãº/g, "ú")
    .replace(/Ã§/g, "ç")
    .replace(/Ã\u0081/g, "Á")
    .replace(/Ã\u0089/g, "É")
    .replace(/Ã\u008D/g, "Í")
    .replace(/Ã\u0093/g, "Ó")
    .replace(/Ã\u009A/g, "Ú")
    .replace(/Ã\u0087/g, "Ç")
    .replace(/intelig[\uFFFD]ncia/gi, "inteligencia")
    .replace(/informa[\uFFFD]{1,2}es/gi, "informacoes")
    .replace(/fa[\uFFFD]a/gi, "faca")
    .replace(/d[\uFFFD]vida/gi, "duvida")
    .replace(/o que [\uFFFD]/gi, "o que e")
    .replace(/let[\uFFFD]cia/gi, "Leticia")
    .replace(/usu[\uFFFD]rio/gi, "Usuario")
    .replace(/\uFFFD+/g, "");
}

function collapseWhitespace(value: string): string {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

function containsTranscriptLabels(value: string): boolean {
  const normalized = `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (!normalized) return false;

  return /\b(?:usuario\s*:|usuario\s*-\s*|user\s*:|assistant\s*:|assistente\s*:|leticia\s*:)\b/.test(
    normalized,
  );
}

function stripDialogueLabels(value: string): string {
  return `${value || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, "\n")
    .trim();
}

function sanitizeConversationText(value: string): string {
  const repaired = repairCommonMojibake(`${value || ""}`);
  const stripped = stripDialogueLabels(repaired);
  return collapseWhitespace(stripped);
}

function sanitizeTopicTag(value: string): string {
  const cleaned = sanitizeConversationText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}_:-]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return cleaned.slice(0, 80) || "general";
}

function sanitizeFollowUpPrompt(value: string | null | undefined): string | null {
  const cleaned = sanitizeConversationText(value || "");
  if (!cleaned) return null;
  if (containsTranscriptLabels(cleaned)) return null;
  return cleaned.slice(0, 220);
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
    stabilizedText: sanitizeConversationText(payload.stabilizedText),
    consolidatedLanguage: payload.consolidatedLanguage,
    speechAct: payload.speechAct,
    pragmaticIntent: typeof payload.pragmaticIntent === "string"
      ? sanitizeConversationText(payload.pragmaticIntent) || "unknown"
      : "unknown",
    referentialMarkers: Array.isArray(payload.referentialMarkers) ? payload.referentialMarkers : [],
    ambiguitySignals: Array.isArray(payload.ambiguitySignals) ? payload.ambiguitySignals : [],
    repetitionDetected: Boolean(payload.repetitionDetected),
    emotionalTone: typeof payload.emotionalTone === "string"
      ? sanitizeConversationText(payload.emotionalTone) || "calm"
      : "calm",
    urgency: payload.urgency === "high" || payload.urgency === "medium" ? payload.urgency : "low",
    discourseRepairSignals: Array.isArray(payload.discourseRepairSignals)
      ? payload.discourseRepairSignals
      : [],
  };
}

function resolveClarificationAmbiguity(
  baseAmbiguity: number,
  handoff: LanguageToConversationPayload | null,
): number {
  if (!handoff) return baseAmbiguity;
  const handoffBoost =
    Math.min(0.24, handoff.ambiguitySignals.length * 0.06) +
    (handoff.discourseRepairSignals.length > 0 ? 0.08 : 0) +
    (handoff.repetitionDetected ? 0.08 : 0);
  return clamp01(baseAmbiguity + handoffBoost);
}

export async function runConversationLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const conversationMode = resolveLayerModeFromState(state, "conversation");
  const handoff = readLanguageHandoff(state);

  const baseText = handoff?.stabilizedText || state.normalizedMessage || state.rawMessage;
  const text = sanitizeConversationText(baseText);
  const ambiguity = resolveClarificationAmbiguity(state.languageState.ambiguity, handoff);
  const effectiveTone = handoff?.emotionalTone === "frustrated" ? "direct" : state.languageState.tone;

  const localContinuity = continuityScorer(state, conversationMode);
  const localTopicShift = topicShiftDetector(state, conversationMode);
  const localCarryover = carryoverPolicy(state, conversationMode);

  const turns = turnManager({ recentTurns: state.recentTurns });
  const topic = topicTracker({
    text,
    fallbackTopic: sanitizeConversationText(state.conversationState.activeTopic) || "general",
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

  const topicShiftDetected = topic.shiftDetected || localTopicShift.topicShift;
  const resolvedTopicRaw = topicShiftDetected
    ? (localTopicShift.candidateTopic || topic.topic)
    : topic.topic;
  const resolvedTopic = sanitizeConversationText(resolvedTopicRaw) || "general";

  const sanitizedFollowUpPrompt = sanitizeFollowUpPrompt(followUp.followUpPrompt);
  const balanceScore = Number(
    clamp01((turns.balanceScore * 0.7) + (localContinuity * 0.3)).toFixed(4),
  );

  state.conversationState = {
    turnCount: turns.turnCount,
    balanceScore,
    activeTopic: resolvedTopic,
    topicShiftDetected,
    needsClarification: clarification.needsClarification,
    clarificationStrategy: clarification.strategy,
    followUpPrompt: sanitizedFollowUpPrompt,
    rapportScore: rapport.rapportScore,
  };

  state.executionArtifacts = {
    ...state.executionArtifacts,
    conversation: {
      operatorMode: conversationMode,
      localContinuity,
      localTopicShift: localTopicShift.topicShift,
      carryoverAllowed: localCarryover.carryoverAllowed,
      candidateTopic: sanitizeConversationText(localCarryover.candidateTopic || ""),
      reasons: (localCarryover.reasons || [])
        .map((item) => sanitizeConversationText(item))
        .filter(Boolean)
        .slice(0, 12),
    },
  };

  state.activeConstraints = [
    ...new Set([
      ...state.activeConstraints,
      ...(containsTranscriptLabels(text) ? ["conversation_input_transcript_sanitized"] : []),
      ...(topicShiftDetected ? ["conversation_topic_shift_local"] : []),
      ...(localCarryover.carryoverAllowed
        ? ["conversation_carryover_allowed"]
        : ["conversation_carryover_restricted"]),
    ]),
  ].slice(-24);

  state.activeContext = [
    ...state.activeContext,
    `conversation_topic:${sanitizeTopicTag(resolvedTopic)}`,
    ...(handoff ? [`conversation_handoff_speech_act:${sanitizeTopicTag(String(handoff.speechAct))}`] : []),
    ...(handoff ? [`conversation_handoff_intent:${sanitizeTopicTag(handoff.pragmaticIntent)}`] : []),
    ...(handoff?.repetitionDetected ? ["conversation_repetition_signal"] : []),
    ...(handoff?.discourseRepairSignals.length ? ["conversation_repair_signal"] : []),
    ...(topicShiftDetected ? ["conversation_topic_shift_detected"] : []),
    ...(localCarryover.carryoverAllowed
      ? ["conversation_context_carryover"]
      : ["conversation_context_rebase"]),
    ...(sanitizedFollowUpPrompt ? [`conversation_followup:${sanitizedFollowUpPrompt}`] : []),
  ].slice(-16);

  state.trace.push(
    makeTraceEvent({
      layer: "conversation",
      action: "conversation_state_updated",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `mode=${conversationMode}; topic=${resolvedTopic}; turnCount=${turns.turnCount}; clarify=${clarification.needsClarification}; ` +
        `rapport=${rapport.rapportScore.toFixed(2)}; continuity=${localContinuity.toFixed(2)}; carryover=${localCarryover.carryoverAllowed}; handoff=${handoff ? "yes" : "no"}`,
    }),
  );

  return handoffConversationToContext(state);
}