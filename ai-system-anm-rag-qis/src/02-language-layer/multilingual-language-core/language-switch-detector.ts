/**
 * Responsabilidade do arquivo:
 * - Detectar troca de idioma dentro do mesmo enunciado (code-switching).
 * - Nao atuar como detector principal de idioma; apenas sinalizar alternancia local.
 * - Gerar spans auditaveis de transicao linguistica para consolidacao posterior.
 */
import type { LanguageSwitchSpan, SupportedLanguage } from "../types/language-signal-types";
import { normalizeForComparison } from "../utils/accent-utils";
import { tokenizeWords } from "../utils/token-utils";

export interface LanguageSwitchInput {
  text: string;
}

export interface LanguageSwitchResult {
  mixedLanguage: boolean;
  involvedLanguages: SupportedLanguage[];
  switches: LanguageSwitchSpan[];
}

const PT_WORDS = new Set(["oi", "voce", "qual", "como", "porque", "por", "entao", "ajuste", "arquivo", "camada"]);
const EN_WORDS = new Set(["hello", "what", "how", "why", "please", "today", "latest", "can", "fix", "file"]);
const ES_WORDS = new Set(["hola", "como", "por", "que", "cual", "hoy", "puede", "archivo", "capa"]);

function classifyToken(token: string): SupportedLanguage {
  const normalized = normalizeForComparison(token);
  if (PT_WORDS.has(normalized)) return "pt-BR";
  if (EN_WORDS.has(normalized)) return "en-US";
  if (ES_WORDS.has(normalized)) return "es-ES";
  return "unknown";
}

export function languageSwitchDetector(input: LanguageSwitchInput): LanguageSwitchResult {
  const tokens = tokenizeWords(input.text);
  const perTokenLanguage = tokens.map((token) => ({ token, language: classifyToken(token) }));
  const involved = new Set<SupportedLanguage>();
  const switches: LanguageSwitchSpan[] = [];

  let previousLanguage: SupportedLanguage = "unknown";
  perTokenLanguage.forEach(({ token, language }, index) => {
    if (language === "unknown") return;
    involved.add(language);
    if (previousLanguage !== "unknown" && previousLanguage !== language) {
      switches.push({
        from: previousLanguage,
        to: language,
        atToken: index,
        excerpt: token,
      });
    }
    previousLanguage = language;
  });

  const involvedLanguages = [...involved];
  return {
    mixedLanguage: involvedLanguages.length >= 2,
    involvedLanguages,
    switches,
  };
}

