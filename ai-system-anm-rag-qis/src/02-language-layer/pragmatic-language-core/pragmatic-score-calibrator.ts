/**
 * Responsabilidade do arquivo:
 * - Unificar regras de calibragem de score pragmatico.
 * - Evitar pontuacoes arbitrarias e incoerentes entre detectores.
 */
import { clamp01 } from "../utils/normalization-utils";

export interface ScoreCalibrationInput {
  base?: number;
  positiveHits?: number;
  negativeHits?: number;
  positiveWeight?: number;
  negativeWeight?: number;
  bonus?: number;
}

export function pragmaticScoreCalibrator(
  input: ScoreCalibrationInput,
): number {
  const base = input.base ?? 0;
  const positiveHits = input.positiveHits ?? 0;
  const negativeHits = input.negativeHits ?? 0;
  const positiveWeight = input.positiveWeight ?? 0.1;
  const negativeWeight = input.negativeWeight ?? 0.08;
  const bonus = input.bonus ?? 0;

  return clamp01(
    base + positiveHits * positiveWeight - negativeHits * negativeWeight + bonus,
  );
}
