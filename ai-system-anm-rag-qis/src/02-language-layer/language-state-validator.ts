/**
 * Responsabilidade do arquivo:
 * - Validar integridade minima do LanguageState canonico antes do handoff.
 * - Registrar erros/avisos para auditoria e seguranca de pipeline.
 * - Aplicar contrato formal da camada sem mutacao do estado.
 */
import { assertLanguageStateContract } from "./contracts/language-state-contract";
import type { LanguageState } from "./types/language-types";

export interface LanguageStateValidationResult {
  valid: boolean;
  errors: string[];
}

export function languageStateValidator(state: LanguageState): LanguageStateValidationResult {
  const errors: string[] = [];

  try {
    assertLanguageStateContract(state);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "language state contract assertion failed");
  }

  if (state.normalization.stabilizedText.length === 0) {
    errors.push("stabilizedText cannot be empty");
  }

  if (state.ambiguity < 0 || state.ambiguity > 1) {
    errors.push("ambiguity out of range [0,1]");
  }

  if (state.languageConfidence < 0 || state.languageConfidence > 1) {
    errors.push("languageConfidence out of range [0,1]");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

