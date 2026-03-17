/**
 * Responsabilidade do arquivo:
 * - Detectar sinais de ambiguidade textual de superficie.
 * - Mapear pistas como referencias vagas e alternativas abertas.
 * - Retornar score local sem inferir verdade/falsidade.
 */
import type { AmbiguitySignal } from "../types/language-signal-types";
import { clamp01, safeLower } from "../utils/normalization-utils";

export interface AmbiguitySignalDetectorInput {
  text: string;
}

export interface AmbiguitySignalDetectorResult {
  signals: AmbiguitySignal[];
  score: number;
}

export function ambiguitySignalDetector(input: AmbiguitySignalDetectorInput): AmbiguitySignalDetectorResult {
  const text = safeLower(input.text);
  const signals: AmbiguitySignal[] = [];

  if (/\b(isso|aquilo|esse ponto|essa parte|coisa)\b/.test(text)) signals.push({ signal: "vague_reference", weight: 0.24 });
  if (/\b(talvez|depende|mais ou menos|de alguma forma)\b/.test(text)) signals.push({ signal: "hedging", weight: 0.22 });
  if (/\b(ou|either|or)\b/.test(text)) signals.push({ signal: "alternatives", weight: 0.14 });
  if (text.split(/\s+/g).filter(Boolean).length <= 4) signals.push({ signal: "short_utterance", weight: 0.2 });

  const score = clamp01(signals.reduce((sum, item) => sum + item.weight, 0));
  return { signals, score };
}

