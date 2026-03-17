/**
 * Responsabilidade do arquivo:
 * - Definir o payload minimo e podado entregue do language-layer ao conversation-layer.
 * - Garantir que o handoff carregue apenas sinais linguisticos necessarios para o proximo estagio.
 * - Permitir validacao objetiva do ponto de transicao entre camadas.
 */
import type { LanguageToConversationPayload } from "../types/language-payload-types";

export const REQUIRED_LANGUAGE_HANDOFF_FIELDS: ReadonlyArray<keyof LanguageToConversationPayload> = [
  "stabilizedText",
  "consolidatedLanguage",
  "speechAct",
  "pragmaticIntent",
  "referentialMarkers",
  "ambiguitySignals",
  "repetitionDetected",
  "emotionalTone",
  "urgency",
  "discourseRepairSignals",
] as const;

export function assertLanguageHandoffContract(payload: LanguageToConversationPayload): void {
  const missing = REQUIRED_LANGUAGE_HANDOFF_FIELDS.filter((field) => payload[field] === undefined || payload[field] === null);
  if (missing.length > 0) {
    throw new Error(`language handoff contract violation: missing fields ${missing.join(", ")}`);
  }
}


