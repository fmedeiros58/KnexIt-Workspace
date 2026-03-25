/**
 * Responsabilidade do arquivo:
 * - Detectar sinais de quantificacao (sempre, nunca, alguns, varios etc.).
 * - Fornecer marcadores de escopo quantitativo para leitura local.
 * - Evitar inferencia estatistica fora do enunciado.
 */
import { dedupeList, safeLower } from "../utils/normalization-utils";

export interface QuantifierSignalDetectorInput {
  text: string;
}

export interface QuantifierSignalDetectorResult {
  quantifiers: string[];
}

export function quantifierSignalDetector(input: QuantifierSignalDetectorInput): QuantifierSignalDetectorResult {
  const text = safeLower(input.text);
  const hits = text.match(/\b(tudo|nada|sempre|nunca|varios|varias|alguns|algumas|todos|nenhum|all|none|many|some)\b/g) || [];
  return { quantifiers: dedupeList(hits).slice(0, 16) };
}

