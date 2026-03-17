/**
 * Responsabilidade do arquivo:
 * - Concentrar enums/unions de sinais linguisticos usados por todos os nucleos.
 * - Evitar strings soltas para facilitar consistencia e auditabilidade.
 * - Definir vocabulrio de classificacao do 02-language-layer.
 */
export type SupportedLanguage =
  | "pt-BR"
  | "pt-PT"
  | "en-US"
  | "en-GB"
  | "es-ES"
  | "es-MX"
  | "unknown";

export type SpeechActType =
  | "question"
  | "request"
  | "instruction"
  | "correction"
  | "objection"
  | "greeting"
  | "confirmation"
  | "statement";

export type PragmaticIntentType =
  | "execute_change"
  | "ask_information"
  | "ask_clarification"
  | "seek_alignment"
  | "social_contact"
  | "challenge"
  | "unknown";

export type AmbiguityLevel = "low" | "medium" | "high";

export type ToneType = "neutral" | "friendly" | "direct" | "formal";

export type EmotionalToneType = "calm" | "positive" | "frustrated" | "urgent" | "confused";

export type UrgencySignalType = "low" | "medium" | "high";

export type ConfidenceStyleType = "certain" | "balanced" | "hesitant";

export type AffectivePolarityType = "negative" | "neutral" | "mixed" | "positive";

export interface LanguageSwitchSpan {
  from: SupportedLanguage;
  to: SupportedLanguage;
  atToken: number;
  excerpt: string;
}

export interface ReferentialMarker {
  marker: string;
  kind: "pronoun" | "demonstrative" | "anaphora";
}

export interface AmbiguitySignal {
  signal: string;
  weight: number;
}

export interface DiscourseRepairSignal {
  snippet: string;
  type: "self-correction" | "restart" | "clarification";
}


