/**
 * Responsabilidade do arquivo:
 * - Detectar idioma principal da entrada com heuristicas lexicais e sinais graficos.
 * - Produzir placar por idioma para auditoria da decisao de linguagem dominante.
 * - Respeitar hint previo sem depender dele como unica fonte.
 */
import type { SupportedLanguage } from "../types/language-signal-types";
import { normalizeForComparison } from "../utils/accent-utils";
import { tokenizeWords } from "../utils/token-utils";

export interface LanguageDetectorInput {
  text: string;
  languageHint?: string;
}

export interface LanguageDetectorResult {
  dominantLanguage: SupportedLanguage;
  scores: Record<SupportedLanguage, number>;
  evidence: string[];
}

const PT_SIGNALS = new Set(["voce", "entao", "porque", "por", "qual", "como", "pedido", "arquivo", "camada", "ajuste"]);
const EN_SIGNALS = new Set(["please", "what", "how", "why", "update", "file", "layer", "request", "latest", "fix"]);
const ES_SIGNALS = new Set(["como", "cual", "por", "que", "ajusta", "archivo", "capa", "pedido", "hoy", "puede"]);
const LANGUAGE_PRIORITY: SupportedLanguage[] = ["pt-BR", "en-US", "es-ES", "pt-PT", "en-GB", "es-MX", "unknown"];

function normalizeHint(value?: string): SupportedLanguage {
  const hint = normalizeForComparison(value || "");
  if (hint.startsWith("pt")) return "pt-BR";
  if (hint.startsWith("en")) return "en-US";
  if (hint.startsWith("es")) return "es-ES";
  return "unknown";
}

function initialScores(hint?: string): Record<SupportedLanguage, number> {
  const scores: Record<SupportedLanguage, number> = {
    "pt-BR": 0,
    "pt-PT": 0,
    "en-US": 0,
    "en-GB": 0,
    "es-ES": 0,
    "es-MX": 0,
    unknown: 0,
  };
  const hinted = normalizeHint(hint);
  if (hinted !== "unknown") {
    scores[hinted] += 0.4;
  }
  return scores;
}

export function languageDetector(input: LanguageDetectorInput): LanguageDetectorResult {
  const tokens = tokenizeWords(normalizeForComparison(input.text));
  const scores = initialScores(input.languageHint);
  const evidence: string[] = [];

  for (const token of tokens) {
    if (PT_SIGNALS.has(token)) {
      scores["pt-BR"] += 1;
      evidence.push(`pt:${token}`);
    }
    if (EN_SIGNALS.has(token)) {
      scores["en-US"] += 1;
      evidence.push(`en:${token}`);
    }
    if (ES_SIGNALS.has(token)) {
      scores["es-ES"] += 1;
      evidence.push(`es:${token}`);
    }
  }

  const ranked = [...LANGUAGE_PRIORITY].sort((left, right) => scores[right] - scores[left]);

  return {
    dominantLanguage: ranked[0],
    scores,
    evidence: evidence.slice(0, 20),
  };
}

