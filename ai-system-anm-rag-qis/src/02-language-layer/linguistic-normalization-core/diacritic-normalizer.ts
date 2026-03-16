/**
 * Responsabilidade do arquivo:
 * - Normalizar problemas de acentuacao/codificacao quebrada em nivel superficial.
 * - Evitar correcao agressiva de ortografia; foco em estabilidade de encoding.
 * - Sinalizar quando houve reparo de diacritico/byte estranho.
 */
import { hasLikelyBrokenEncoding } from "../utils/accent-utils";

export interface DiacriticNormalizerInput {
  text: string;
}

export interface DiacriticNormalizerResult {
  text: string;
  changed: boolean;
}

const BROKEN_ENCODING_MAP: ReadonlyArray<[string, string]> = [
  ["\u00C3\u00A1", "a"],
  ["\u00C3\u00A3", "a"],
  ["\u00C3\u00A7", "c"],
  ["\u00C3\u00A9", "e"],
  ["\u00C3\u00AA", "e"],
  ["\u00C3\u00B3", "o"],
  ["\u00C3\u00BA", "u"],
  ["\u00C2", ""],
];

export function diacriticNormalizer(input: DiacriticNormalizerInput): DiacriticNormalizerResult {
  const before = `${input.text || ""}`;
  if (!hasLikelyBrokenEncoding(before)) return { text: before, changed: false };

  let after = before;
  for (const [pattern, replacement] of BROKEN_ENCODING_MAP) {
    after = after.split(pattern).join(replacement);
  }

  return {
    text: after,
    changed: after !== before,
  };
}

