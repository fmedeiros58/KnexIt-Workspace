/**
 * Responsabilidade do arquivo:
 * - Detectar fronteiras de frase em nivel superficial.
 * - Produzir sentencas segmentadas para os demais detectores discursivos.
 * - Manter segmentacao leve, sem parse sintatico profundo.
 */
import { splitSentences } from "../utils/token-utils";

export interface SentenceBoundaryDetectorInput {
  text: string;
}

export interface SentenceBoundaryDetectorResult {
  sentences: string[];
}

export function sentenceBoundaryDetector(input: SentenceBoundaryDetectorInput): SentenceBoundaryDetectorResult {
  return {
    sentences: splitSentences(input.text),
  };
}

