/**
 * Responsabilidade do arquivo:
 * - Consolidar diagnostico linguistico final (idioma, locale, dialeto, troca de idioma).
 * - Unificar resultados dos detectores sem sobrepor responsabilidades individuais.
 * - Fornecer bloco unico para LanguageState com trilha explicita de evidencias.
 */
import type { SupportedLanguage } from "../types/language-signal-types";
import { dialectDetector } from "./dialect-detector";
import { languageConfidenceScorer } from "./language-confidence-scorer";
import { languageDetector } from "./language-detector";
import { languageSwitchDetector } from "./language-switch-detector";
import { localeDetector } from "./locale-detector";

export interface LanguageResolutionInput {
  text: string;
  languageHint?: string;
}

export interface LanguageResolutionResult {
  dominantLanguage: SupportedLanguage;
  locale: SupportedLanguage;
  dialectHints: string[];
  mixedLanguage: boolean;
  languageSwitches: ReturnType<typeof languageSwitchDetector>["switches"];
  confidence: number;
  evidence: string[];
}

export function languageResolutionEngine(input: LanguageResolutionInput): LanguageResolutionResult {
  const language = languageDetector({ text: input.text, languageHint: input.languageHint });
  const locale = localeDetector({ text: input.text, dominantLanguage: language.dominantLanguage });
  const dialect = dialectDetector({ text: input.text, locale: locale.locale });
  const switchSignal = languageSwitchDetector({ text: input.text });
  const confidence = languageConfidenceScorer({
    scores: language.scores,
    mixedLanguage: switchSignal.mixedLanguage,
    switchCount: switchSignal.switches.length,
  });

  return {
    dominantLanguage: language.dominantLanguage,
    locale: locale.locale,
    dialectHints: dialect.dialectHints,
    mixedLanguage: switchSignal.mixedLanguage,
    languageSwitches: switchSignal.switches,
    confidence: confidence.confidence,
    evidence: [...language.evidence, locale.rationale].slice(0, 24),
  };
}

