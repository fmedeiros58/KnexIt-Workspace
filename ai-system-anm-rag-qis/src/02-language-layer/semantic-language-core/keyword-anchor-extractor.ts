/**
 * Responsabilidade do arquivo:
 * - Extrair ancoras lexicais fortes (keywords) da superficie textual.
 * - Priorizar termos utilitarios para foco semantico local.
 * - Servir de base para agregacao semantica e rastreabilidade.
 */
import { normalizeForComparison } from "../utils/accent-utils";
import { tokenizeWords } from "../utils/token-utils";

export interface KeywordAnchorExtractorInput {
  text: string;
}

export interface KeywordAnchorExtractorResult {
  anchors: string[];
}

const STOPWORDS = new Set([
  "a",
  "o",
  "e",
  "de",
  "do",
  "da",
  "the",
  "and",
  "to",
  "que",
  "um",
  "uma",
  "para",
  "com",
  "na",
  "no",
  "in",
  "on",
  "is",
  "are",
]);

export function keywordAnchorExtractor(input: KeywordAnchorExtractorInput): KeywordAnchorExtractorResult {
  const frequencies = new Map<string, number>();
  for (const token of tokenizeWords(normalizeForComparison(input.text))) {
    if (token.length < 3 || STOPWORDS.has(token)) continue;
    frequencies.set(token, (frequencies.get(token) || 0) + 1);
  }

  const anchors = [...frequencies.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([token]) => token);

  return { anchors };
}

