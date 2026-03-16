/**
 * Responsabilidade do arquivo:
 * - Adaptar/podar o resultado linguistico para o conversation-layer.
 * - Evitar despejo integral do LanguageState, preservando apenas sinais essenciais de handoff.
 * - Validar contratos de transicao entre camadas com foco em auditabilidade.
 */
import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { assertLanguageHandoffContract } from "./contracts/language-handoff-contract";
import type { LanguageToConversationPayload } from "./types/language-payload-types";

const LANGUAGE_TO_CONVERSATION_CONTRACT = {
  from: "language",
  to: "conversation",
  requiredFields: ["normalizedMessage", "language", "inputSignals", "languageState"],
} as const;

function toConversationPayload(state: ProcessingState): LanguageToConversationPayload {
  const languageState = state.languageState as ProcessingState["languageState"] & Record<string, any>;

  return {
    stabilizedText: state.normalizedMessage,
    consolidatedLanguage: state.language as LanguageToConversationPayload["consolidatedLanguage"],
    speechAct: languageState.speechAct as LanguageToConversationPayload["speechAct"],
    pragmaticIntent: languageState.pragmaticIntent || languageState.primaryIntent || "unknown",
    referentialMarkers: languageState.referentialMarkers || [],
    ambiguitySignals: languageState.ambiguitySignals || [],
    repetitionDetected: Boolean(languageState.repetitionDetected),
    emotionalTone: languageState.emotionalTone || "calm",
    urgency: (languageState.urgency || state.inputSignals.urgency) as LanguageToConversationPayload["urgency"],
    discourseRepairSignals: languageState.discourseRepairSignals || [],
  };
}

export function handoffLanguageToConversation(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, LANGUAGE_TO_CONVERSATION_CONTRACT);

  const payload = toConversationPayload(state);
  assertLanguageHandoffContract(payload);

  state.userProfile = {
    ...state.userProfile,
    languageHandoff: payload,
  };

  state.activeContext = [
    ...state.activeContext,
    `language_handoff:speechAct=${payload.speechAct}`,
    `language_handoff:intent=${payload.pragmaticIntent}`,
    `language_handoff:emotion=${payload.emotionalTone}`,
    ...(payload.repetitionDetected ? ["language_handoff:repetition_detected"] : []),
  ].slice(-24);

  return state;
}

