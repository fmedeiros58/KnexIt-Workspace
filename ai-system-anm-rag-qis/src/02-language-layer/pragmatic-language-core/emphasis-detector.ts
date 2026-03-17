/**
 * Responsabilidade do arquivo:
 * - Detectar enfase argumentativa por intensificadores, repeticao e grafia enfatica.
 * - Medir intensidade de enfase sem inferir emocao completa.
 * - Expor marcadores usados no calculo para auditoria.
 */
import { clamp01 } from "../utils/normalization-utils";

export interface EmphasisDetectorInput {
  text: string;
}

export interface EmphasisDetectorResult {
  strength: number;
  markers: string[];
}

export function emphasisDetector(input: EmphasisDetectorInput): EmphasisDetectorResult {
  const text = `${input.text || ""}`;
  const lowered = text.toLowerCase();
  const markers: string[] = [];

  const capsTokens = (text.match(/\b[A-Z]{3,}\b/g) || []).length;
  const repeatedPunctuation = (text.match(/[!?]{2,}/g) || []).length;
  const intensifiers = (lowered.match(/\b(muito|extremamente|super|realmente|demais|urgentemente)\b/g) || []).length;

  if (capsTokens > 0) markers.push("caps");
  if (repeatedPunctuation > 0) markers.push("repeated_punctuation");
  if (intensifiers > 0) markers.push("intensifiers");

  return {
    strength: clamp01(0.08 + capsTokens * 0.18 + repeatedPunctuation * 0.15 + intensifiers * 0.12),
    markers,
  };
}

