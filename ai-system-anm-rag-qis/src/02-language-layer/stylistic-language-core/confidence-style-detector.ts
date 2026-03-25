/**
 * Responsabilidade do arquivo:
 * - Detectar estilo de confianca discursiva (certain, balanced, hesitant).
 * - Mapear marcadores de certeza e mitigacao.
 * - Entregar classe compacta para o estado estilistico.
 */
import type { ConfidenceStyleType } from "../types/language-signal-types";

export interface ConfidenceStyleDetectorInput {
  text: string;
}

export interface ConfidenceStyleDetectorResult {
  confidenceStyle: ConfidenceStyleType;
}

export function confidenceStyleDetector(input: ConfidenceStyleDetectorInput): ConfidenceStyleDetectorResult {
  const text = `${input.text || ""}`.toLowerCase();
  const certainty = (text.match(/\b(com certeza|certamente|sem duvida|obviamente)\b/g) || []).length;
  const hesitation = (text.match(/\b(talvez|acho que|nao sei|pode ser)\b/g) || []).length;

  if (certainty > hesitation + 1) return { confidenceStyle: "certain" };
  if (hesitation > certainty) return { confidenceStyle: "hesitant" };
  return { confidenceStyle: "balanced" };
}

