/**
 * Responsabilidade do arquivo:
 * - Detectar operadores modais (pode, deve, talvez, poderia etc.).
 * - Capturar grau de modalidade para leitura semantica de compromisso.
 * - Entregar lista limpa para agregacao semantica.
 */
import { dedupeList, safeLower } from "../utils/normalization-utils";

export interface ModalOperatorDetectorInput {
  text: string;
}

export interface ModalOperatorDetectorResult {
  operators: string[];
}

export function modalOperatorDetector(input: ModalOperatorDetectorInput): ModalOperatorDetectorResult {
  const text = safeLower(input.text);
  const matches = text.match(/\b(pode|deve|talvez|precisa|seria|poderia|must|should|might|may|can)\b/g) || [];
  return { operators: dedupeList(matches).slice(0, 16) };
}

