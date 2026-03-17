/**
 * Responsabilidade do arquivo:
 * - Definir a forma canonica do LanguageState para toda a camada 02.
 * - Separar subestados por responsabilidade (idioma, pragmatica, semantica, discurso, estilo).
 * - Permitir auditoria por trilhas de decisao sem acoplar detalhes ao conversation-layer.
 */
import type {
  AffectivePolarityType,
  AmbiguitySignal,
  ConfidenceStyleType,
  DiscourseRepairSignal,
  EmotionalToneType,
  LanguageSwitchSpan,
  PragmaticIntentType,
  ReferentialMarker,
  SpeechActType,
  SupportedLanguage,
  ToneType,
  UrgencySignalType,
} from "./language-signal-types";

export interface LanguageDetectionState {
  dominantLanguage: SupportedLanguage;
  locale: SupportedLanguage;
  dialectHints: string[];
  mixedLanguage: boolean;
  languageSwitches: LanguageSwitchSpan[];
  confidence: number;
}

export interface NormalizationAction {
  step: string;
  before: string;
  after: string;
  changed: boolean;
}

export interface LanguageNormalizationState {
  sourceText: string;
  stabilizedText: string;
  canonicalText: string;
  steps: NormalizationAction[];
}

export interface PragmaticState {
  speechAct: SpeechActType;
  intent: PragmaticIntentType;
  politeness: number;
  indirectRequest: boolean;
  directiveForce: number;
  emphasisStrength: number;
  implicatureSignals: string[];
  relationalCues: string[];
}

export interface SurfaceSemanticState {
  semanticFocus: string;
  primaryIntent: string;
  keywordAnchors: string[];
  entities: string[];
  referentialMarkers: ReferentialMarker[];
  ambiguitySignals: AmbiguitySignal[];
  ambiguityScore: number;
  negationSpans: string[];
  modalOperators: string[];
  quantifierSignals: string[];
  scopeFragility: number;
}

export interface DiscourseFormState {
  sentenceCount: number;
  fragmentDetected: boolean;
  rhetoricalQuestionDetected: boolean;
  repetitionDetected: boolean;
  repetitionSegments: string[];
  discourseMarkers: string[];
  topicShiftDetected: boolean;
  repairSignals: DiscourseRepairSignal[];
  dialogueShape: "single-turn" | "multi-claim" | "request-then-constraint" | "other";
}

export interface StylisticAffectiveState {
  tone: ToneType;
  register: "informal" | "balanced" | "formal";
  emotionalTone: EmotionalToneType;
  urgency: UrgencySignalType;
  frustrationScore: number;
  confidenceStyle: ConfidenceStyleType;
  hesitationScore: number;
  insistenceScore: number;
  affectivePolarity: AffectivePolarityType;
}

export interface LanguageAuditEntry {
  stage: string;
  decision: string;
  score?: number;
}

export interface LanguageState {
  semanticFocus: string;
  primaryIntent: string;
  ambiguity: number;
  speechAct: SpeechActType;
  politeness: number;
  tone: ToneType;
  register: "informal" | "balanced" | "formal";
  mixedLanguage: boolean;
  stabilizedText: string;
  dominantLanguage: SupportedLanguage;
  locale: SupportedLanguage;
  languageConfidence: number;
  pragmaticIntent: PragmaticIntentType;
  referentialMarkers: ReferentialMarker[];
  ambiguitySignals: AmbiguitySignal[];
  repetitionDetected: boolean;
  emotionalTone: EmotionalToneType;
  urgency: UrgencySignalType;
  discourseRepairSignals: DiscourseRepairSignal[];
  language: LanguageDetectionState;
  normalization: LanguageNormalizationState;
  pragmatic: PragmaticState;
  semantic: SurfaceSemanticState;
  discourse: DiscourseFormState;
  stylistic: StylisticAffectiveState;
  auditTrail: LanguageAuditEntry[];
}


