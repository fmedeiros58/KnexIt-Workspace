/**
 * Responsabilidade do arquivo:
 * - Detectar repeticao mecanica ou enfatica entre sentencas proximas.
 * - Marcar segmentos repetidos para evitar eco em camadas seguintes.
 * - Expor flag simples e segmentos capturados.
 */
import { similarityScore } from "../utils/string-distance-utils";
import { sentenceBoundaryDetector } from "./sentence-boundary-detector";

export interface RepetitionPatternDetectorInput {
  text: string;
}

export interface RepetitionPatternDetectorResult {
  repetitionDetected: boolean;
  repeatedSegments: string[];
}

export function repetitionPatternDetector(input: RepetitionPatternDetectorInput): RepetitionPatternDetectorResult {
  const sentences = sentenceBoundaryDetector({ text: input.text }).sentences;
  const repeated = new Set<string>();

  for (let index = 1; index < sentences.length; index += 1) {
    const previous = sentences[index - 1].toLowerCase();
    const current = sentences[index].toLowerCase();
    if (similarityScore(previous, current) >= 0.86) {
      repeated.add(sentences[index - 1]);
      repeated.add(sentences[index]);
    }
  }

  return {
    repetitionDetected: repeated.size > 0,
    repeatedSegments: [...repeated].slice(0, 8),
  };
}

