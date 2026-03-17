/**
 * Responsabilidade do arquivo:
 * - Detectar fragmentos incompletos de frase em superficie textual.
 * - Sinalizar quando o turno parece truncado ou telegra?fico.
 * - Fornecer flag simples para estrategia de clarificacao.
 */
import { sentenceBoundaryDetector } from "./sentence-boundary-detector";

export interface FragmentDetectorInput {
  text: string;
}

export interface FragmentDetectorResult {
  fragmentDetected: boolean;
  fragments: string[];
}

function looksLikeFragment(sentence: string): boolean {
  const trimmed = sentence.trim();
  if (!trimmed) return false;
  if (trimmed.split(/\s+/g).length <= 2) return true;
  return /^(e|mas|ou|porque|entao|if|and|but)\b/i.test(trimmed);
}

export function fragmentDetector(input: FragmentDetectorInput): FragmentDetectorResult {
  const sentences = sentenceBoundaryDetector({ text: input.text }).sentences;
  const fragments = sentences.filter(looksLikeFragment);
  return {
    fragmentDetected: fragments.length > 0,
    fragments,
  };
}

