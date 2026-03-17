/**
 * Responsabilidade do arquivo:
 * - Detectar perguntas retoricas com base em marcadores linguisticos tipicos.
 * - Diferenciar pergunta informativa de pergunta enfatica/retorica simples.
 * - Entregar apenas sinal local para agregacao discursiva.
 */
import { sentenceBoundaryDetector } from "./sentence-boundary-detector";

export interface RhetoricalQuestionDetectorInput {
  text: string;
}

export interface RhetoricalQuestionDetectorResult {
  rhetoricalQuestionDetected: boolean;
  cues: string[];
}

const RHETORICAL_CUES = [
  /\bnao e obvio\?/i,
  /\bprecisa mesmo perguntar\?/i,
  /\bquem nao sabe\?/i,
  /\bisn't it obvious\?/i,
  /\bserio\?/i,
];

export function rhetoricalQuestionDetector(input: RhetoricalQuestionDetectorInput): RhetoricalQuestionDetectorResult {
  const sentences = sentenceBoundaryDetector({ text: input.text }).sentences;
  const cues = sentences.filter((sentence) => RHETORICAL_CUES.some((pattern) => pattern.test(sentence.toLowerCase())));
  return {
    rhetoricalQuestionDetected: cues.length > 0,
    cues,
  };
}

