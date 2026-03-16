/**
 * Responsabilidade do arquivo:
 * - Detectar sinais de implicatura (conteudo sugerido, nao totalmente explicito).
 * - Listar pistas linguisticas que sugerem expectativa, contraste ou critica indireta.
 * - Nao executar inferencia profunda; apenas marcar candidatos.
 */
import { collectPatternMatches } from "../utils/phrase-pattern-utils";

export interface ImplicatureSignalDetectorInput {
  text: string;
}

export interface ImplicatureSignalDetectorResult {
  signals: string[];
}

const IMPLICATURE_PATTERN = /\b(nao e por nada|so lembrando|ja que|ate porque|de novo|as always|you know|francamente)\b/gi;

export function implicatureSignalDetector(input: ImplicatureSignalDetectorInput): ImplicatureSignalDetectorResult {
  return {
    signals: collectPatternMatches(input.text, IMPLICATURE_PATTERN).map((value) => value.toLowerCase()),
  };
}

