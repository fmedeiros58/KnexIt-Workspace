/**
 * Responsabilidade do arquivo:
 * - Definir thresholds e limites numericos para detectores linguisticos.
 * - Tornar calibracao explicitamente versionavel e auditavel.
 * - Centralizar valores para reduzir divergencias entre modulos.
 */
export const LANGUAGE_THRESHOLDS = {
  mixedLanguageMinSignals: 2,
  dominantLanguageMinScore: 1,
  ambiguityLowMax: 0.33,
  ambiguityMediumMax: 0.66,
  urgencyHighMin: 0.72,
  urgencyMediumMin: 0.4,
  politenessHighMin: 0.7,
  directiveHighMin: 0.7,
  repetitionSimilarityMin: 0.86,
  confidenceCertainMin: 0.66,
} as const;

export type LanguageThresholdKey = keyof typeof LANGUAGE_THRESHOLDS;


