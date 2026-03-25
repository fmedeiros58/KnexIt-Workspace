/**
 * Responsabilidade do arquivo:
 * - Detectar tracos dialetais/regionalismos com utilidade pragmatica leve.
 * - Entregar somente pistas de superficie, sem inferencia sociolinguistica profunda.
 * - Produzir lista curta para suporte de estilo e contextualizacao.
 */
import { normalizeForComparison } from "../utils/accent-utils";

export interface DialectDetectorInput {
  text: string;
  locale: string;
}

export interface DialectDetectorResult {
  dialectHints: string[];
}

export function dialectDetector(input: DialectDetectorInput): DialectDetectorResult {
  const text = normalizeForComparison(input.text);
  const hints = new Set<string>();

  if (/\b(guria|bah|tri)\b/.test(text)) hints.add("pt-br-south");
  if (/\b(oxente|arretado|visse)\b/.test(text)) hints.add("pt-br-northeast");
  if (/\b(man|mate)\b/.test(text) && input.locale === "en-GB") hints.add("en-uk-colloquial");
  if (/\b(yall)\b/.test(text) && input.locale === "en-US") hints.add("en-us-southern");
  if (/\b(che|boludo)\b/.test(text)) hints.add("es-rio-plate");

  return {
    dialectHints: [...hints].slice(0, 8),
  };
}

