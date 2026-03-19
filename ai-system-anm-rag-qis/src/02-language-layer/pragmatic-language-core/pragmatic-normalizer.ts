/**
 * Responsabilidade do arquivo:
 * - Criar uma versao pragmaticamente estavel do texto.
 * - Reduzir variacoes superficiais que atrapalham detectores.
 * - Preservar intencao sem fazer inferencia semantica profunda.
 */
import { safeLower } from "../utils/normalization-utils";

export interface PragmaticNormalizerInput {
  text: string;
}

export interface PragmaticNormalizerResult {
  originalText: string;
  normalizedText: string;
  compactText: string;
  tokens: string[];
}

function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizePunctuation(text: string): string {
  return text
    .replace(/[!?]{2,}/g, "?!")
    .replace(/\.{2,}/g, ".")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/([,.!?;:])([^\s])/g, "$1 $2");
}

function normalizeCommonVariants(text: string): string {
  return text
    .replace(/\bfaca\b/g, "faça")
    .replace(/\bvoce\b/g, "você")
    .replace(/\bsera\b/g, "será")
    .replace(/\bnao\b/g, "não")
    .replace(/\bpode me chamar\b/g, "me chame")
    .replace(/\bpoderia me chamar\b/g, "me chame")
    .replace(/\bpasse a me chamar\b/g, "me chame")
    .replace(/\bquero que me chame\b/g, "me chame")
    .replace(/\bgostaria que\b/g, "quero que")
    .replace(/\bteria como\b/g, "poderia")
    .replace(/\bsera que\b/g, "poderia")
    .replace(/\bserá que\b/g, "poderia");
}

export function pragmaticNormalizer(
  input: PragmaticNormalizerInput,
): PragmaticNormalizerResult {
  const originalText = `${input.text || ""}`;
  const lowered = safeLower(originalText);
  const punctuated = normalizePunctuation(lowered);
  const normalized = normalizeCommonVariants(normalizeWhitespace(punctuated));
  const compactText = normalizeWhitespace(stripDiacritics(normalized));

  return {
    originalText,
    normalizedText: normalized,
    compactText,
    tokens: compactText.split(" ").filter(Boolean),
  };
}
