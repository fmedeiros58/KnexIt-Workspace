/**
 * Responsabilidade do arquivo:
 * - Inferir a intencao pragmatica predominante por tras do enunciado.
 * - Usar ato de fala como pista, sem substituir o estado de conversacao.
 * - Entregar categoria compacta para handoff linguistico.
 */
import type { PragmaticIntentType, SpeechActType } from "../types/language-signal-types";
import { safeLower } from "../utils/normalization-utils";

export interface PragmaticIntentDetectorInput {
  text: string;
  speechAct: SpeechActType;
}

export interface PragmaticIntentDetectorResult {
  intent: PragmaticIntentType;
  rationale: string;
}

export function pragmaticIntentDetector(input: PragmaticIntentDetectorInput): PragmaticIntentDetectorResult {
  const text = safeLower(input.text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/\bentao\s+(faca|refaca)|\b(faca|refaca|continue|prossiga|siga)\b/.test(text)) {
    return { intent: "execute_change", rationale: "follow-up directive cue" };
  }

  if (input.speechAct === "instruction" || input.speechAct === "request") {
    return { intent: "execute_change", rationale: "directive speech act" };
  }

  if (input.speechAct === "question") {
    if (/\b(explique|explica|nao entendi|clarifique|clarify)\b/.test(text)) {
      return { intent: "ask_clarification", rationale: "explicit clarification cue" };
    }
    return { intent: "ask_information", rationale: "information-seeking question" };
  }

  if (input.speechAct === "greeting") {
    return { intent: "social_contact", rationale: "greeting act" };
  }

  if (input.speechAct === "objection") {
    return { intent: "challenge", rationale: "objection act" };
  }

  if (/\b(certo\?|faz sentido|concorda\?)\b/.test(text)) {
    return { intent: "seek_alignment", rationale: "alignment check marker" };
  }

  return { intent: "unknown", rationale: "no strong pragmatic signal" };
}

