/**
 * Responsabilidade do arquivo:
 * - Detectar localidade linguistica (locale) a partir de tracos lexicais simples.
 * - Diferenciar variantes como pt-BR/pt-PT e en-US/en-GB quando ha evidencia.
 * - Manter fallback deterministico para evitar escolhas aleatorias.
 */
import type { SupportedLanguage } from "../types/language-signal-types";
import { normalizeForComparison } from "../utils/accent-utils";

export interface LocaleDetectorInput {
  text: string;
  dominantLanguage: SupportedLanguage;
}

export interface LocaleDetectorResult {
  locale: SupportedLanguage;
  rationale: string;
}

function hasSignal(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

export function localeDetector(input: LocaleDetectorInput): LocaleDetectorResult {
  const text = normalizeForComparison(input.text);

  if (input.dominantLanguage.startsWith("pt")) {
    if (hasSignal(text, /\b(tu|autocarro|fixe|voces)\b/)) return { locale: "pt-PT", rationale: "pt-pt lexical markers" };
    return { locale: "pt-BR", rationale: "default pt locale with no pt-PT marker" };
  }

  if (input.dominantLanguage.startsWith("en")) {
    if (hasSignal(text, /\b(colour|organise|favourite|centre)\b/)) return { locale: "en-GB", rationale: "en-gb spelling markers" };
    return { locale: "en-US", rationale: "default en locale with no en-GB marker" };
  }

  if (input.dominantLanguage.startsWith("es")) {
    if (hasSignal(text, /\b(ustedes|computadora|carro)\b/)) return { locale: "es-MX", rationale: "es-mx lexical markers" };
    return { locale: "es-ES", rationale: "default es locale with no es-MX marker" };
  }

  return { locale: "unknown", rationale: "unknown dominant language" };
}

