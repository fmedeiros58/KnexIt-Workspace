/**
 * Responsabilidade do arquivo:
 * - Detectar pedidos indiretos formulados como sugestao/pergunta socialmente mitigada.
 * - Sinalizar quando a forca diretiva existe sem imperativo explicito.
 * - Entregar marcadores para calibrar estilo de resposta.
 */
import { collectPatternMatches } from "../utils/phrase-pattern-utils";

export interface IndirectRequestDetectorInput {
  text: string;
}

export interface IndirectRequestDetectorResult {
  detected: boolean;
  cues: string[];
}

const PATTERN = /\b(sera que|teria como|voce poderia|would you mind|if possible|quando puder)\b/gi;

export function indirectRequestDetector(input: IndirectRequestDetectorInput): IndirectRequestDetectorResult {
  const cues = collectPatternMatches(input.text, PATTERN).map((value) => value.toLowerCase());
  return {
    detected: cues.length > 0,
    cues,
  };
}

