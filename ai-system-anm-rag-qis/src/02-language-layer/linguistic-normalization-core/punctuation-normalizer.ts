/**
 * Responsabilidade do arquivo:
 * - Normalizar excesso/falta basica de pontuacao para leitura estavel.
 * - Corrigir sequencias repetidas e espacos incorretos junto a pontuacao.
 * - Nao reescrever estilo, apenas limpar ruido superficial.
 */
import { normalizePunctuationSpacing } from "../utils/normalization-utils";

export interface PunctuationNormalizerInput {
  text: string;
}

export interface PunctuationNormalizerResult {
  text: string;
  changed: boolean;
}

export function punctuationNormalizer(input: PunctuationNormalizerInput): PunctuationNormalizerResult {
  const before = `${input.text || ""}`;
  const after = normalizePunctuationSpacing(before)
    .replace(/[!]{3,}/g, "!!")
    .replace(/[?]{3,}/g, "??")
    .replace(/([,.!?;:]){2,}/g, "$1$1");

  return { text: after, changed: before !== after };
}

