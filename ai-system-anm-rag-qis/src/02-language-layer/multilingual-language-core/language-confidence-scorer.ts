/**
 * Responsabilidade do arquivo:
 * - Calcular confianca do diagnostico linguistico consolidado.
 * - Balancear distancia entre primeiro e segundo idioma com evidencia de troca.
 * - Gerar score em [0,1] para controle de qualidade/auditoria.
 */
import { clamp01 } from "../utils/normalization-utils";

export interface LanguageConfidenceScorerInput {
  scores: Record<string, number>;
  mixedLanguage: boolean;
  switchCount: number;
}

export interface LanguageConfidenceScorerResult {
  confidence: number;
}

export function languageConfidenceScorer(input: LanguageConfidenceScorerInput): LanguageConfidenceScorerResult {
  const ordered = Object.values(input.scores).sort((left, right) => right - left);
  const top = ordered[0] || 0;
  const second = ordered[1] || 0;
  const spread = top - second;
  const raw = 0.22 + spread * 0.5 + (top > 0 ? 0.2 : 0) - (input.mixedLanguage ? 0.08 : 0) - input.switchCount * 0.02;

  return {
    confidence: clamp01(raw),
  };
}

