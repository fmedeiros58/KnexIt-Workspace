/**
 * Responsabilidade do arquivo:
 * - Detectar conectores/marcadores discursivos que organizam o turno.
 * - Entregar lista de marcadores para analise de estrutura local.
 * - Limitar escopo a padroes explicitos de superficie.
 */
import { dedupeList } from "../utils/normalization-utils";

export interface DiscourseMarkerDetectorInput {
  text: string;
}

export interface DiscourseMarkerDetectorResult {
  markers: string[];
}

export function discourseMarkerDetector(input: DiscourseMarkerDetectorInput): DiscourseMarkerDetectorResult {
  const text = `${input.text || ""}`.toLowerCase();
  const matches = text.match(/\b(entao|alem disso|porem|contudo|agora|por fim|enfim|by the way|however|therefore)\b/g) || [];
  return {
    markers: dedupeList(matches).slice(0, 16),
  };
}

