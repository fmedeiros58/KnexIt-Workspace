/**
 * Responsabilidade do arquivo:
 * - Detectar insistencia por repeticao intencional de pedidos/palavras.
 * - Medir intensidade de insistencia sem confundir com urgencia.
 * - Fornecer score para adaptacao de resposta.
 */
import { similarityScore } from "../utils/string-distance-utils";
import { splitSentences } from "../utils/token-utils";

export interface InsistenceDetectorInput {
  text: string;
}

export interface InsistenceDetectorResult {
  insistenceScore: number;
}

export function insistenceDetector(input: InsistenceDetectorInput): InsistenceDetectorResult {
  const sentences = splitSentences(input.text).map((value) => value.toLowerCase());
  if (sentences.length < 2) return { insistenceScore: 0 };

  let maxSimilarity = 0;
  for (let index = 1; index < sentences.length; index += 1) {
    maxSimilarity = Math.max(maxSimilarity, similarityScore(sentences[index - 1], sentences[index]));
  }

  return {
    insistenceScore: Math.max(0, Math.min(1, maxSimilarity)),
  };
}

