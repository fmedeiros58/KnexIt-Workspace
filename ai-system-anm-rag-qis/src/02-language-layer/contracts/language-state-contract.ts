/**
 * Responsabilidade do arquivo:
 * - Definir regras minimas de integridade para o LanguageState canonico.
 * - Expor validacao simples e deterministica para auditoria da camada.
 * - Evitar que estados incompletos avancem para o handoff.
 */
import type { LanguageState } from "../types/language-types";

export const REQUIRED_LANGUAGE_STATE_FIELDS: ReadonlyArray<keyof LanguageState> = [
  "semanticFocus",
  "primaryIntent",
  "ambiguity",
  "speechAct",
  "politeness",
  "tone",
  "register",
  "mixedLanguage",
  "stabilizedText",
  "dominantLanguage",
  "pragmaticIntent",
] as const;

export function assertLanguageStateContract(state: LanguageState): void {
  const missing = REQUIRED_LANGUAGE_STATE_FIELDS.filter((field) => {
    const value = state[field];
    return value === undefined || value === null || value === "";
  });
  if (missing.length > 0) {
    throw new Error(`language state contract violation: missing fields ${missing.join(", ")}`);
  }
}


