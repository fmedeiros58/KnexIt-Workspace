/**
 * Responsabilidade do arquivo:
 * - Definir payloads de entrada e saida da camada de linguagem.
 * - Explicitar o que entra no pipeline linguistico e o que sai para handoff.
 * - Apoiar rastreabilidade de dados processados em cada estagio.
 */
import type {
  AmbiguitySignal,
  DiscourseRepairSignal,
  ReferentialMarker,
  SpeechActType,
  SupportedLanguage,
  UrgencySignalType,
} from "./language-signal-types";
import type { LanguageState } from "./language-types";

export interface LanguageLayerInputPayload {
  rawText: string;
  normalizedText: string;
  languageHint?: string;
}

export interface LanguageLayerOutputPayload {
  state: LanguageState;
  stabilizedText: string;
}

export interface LanguageToConversationPayload {
  stabilizedText: string;
  consolidatedLanguage: SupportedLanguage;
  speechAct: SpeechActType;
  pragmaticIntent: string;
  referentialMarkers: ReferentialMarker[];
  ambiguitySignals: AmbiguitySignal[];
  repetitionDetected: boolean;
  emotionalTone: string;
  urgency: UrgencySignalType;
  discourseRepairSignals: DiscourseRepairSignal[];
}


