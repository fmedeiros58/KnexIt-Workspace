/**
 * Responsabilidade do arquivo:
 * - Normalizar espacos, tabs e quebras simples sem alterar conteudo semantico.
 * - Entregar base textual limpa para os demais normalizadores.
 * - Registrar mudanca de forma objetiva.
 */
import { compactWhitespace } from "../utils/normalization-utils";

export interface WhitespaceNormalizerInput {
  text: string;
}

export interface WhitespaceNormalizerResult {
  text: string;
  changed: boolean;
}

export function whitespaceNormalizer(input: WhitespaceNormalizerInput): WhitespaceNormalizerResult {
  const before = `${input.text || ""}`;
  const after = compactWhitespace(before);
  return { text: after, changed: after !== before };
}

