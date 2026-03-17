/**
 * Responsabilidade do arquivo:
 * - Montar o LanguageState final a partir dos blocos especializados da camada.
 * - Preservar rastreabilidade de decisoes com trilha de auditoria por estagio.
 * - Isolar consolidacao de estado do bridge principal para reduzir acoplamento.
 */
import type { LanguageResolutionResult } from "./multilingual-language-core/language-resolution-engine";
import type { NormalizationAction, LanguageState } from "./types/language-types";

export interface LanguageStateBuilderInput {
  sourceText: string;
  stabilizedText: string;
  canonicalText: string;
  normalizationSteps: NormalizationAction[];
  language: LanguageResolutionResult;
  pragmatic: {
    speechAct: LanguageState["speechAct"];
    intent: LanguageState["pragmaticIntent"];
    politeness: number;
    register: LanguageState["register"];
    indirectRequest: boolean;
    directiveForce: number;
    emphasisStrength: number;
    implicatureSignals: string[];
    relationalCues: string[];
  };
  semantic: {
    semanticFocus: string;
    primaryIntent: string;
    ambiguity: number;
    keywordAnchors: string[];
    entities: string[];
    referentialMarkers: LanguageState["referentialMarkers"];
    ambiguitySignals: LanguageState["ambiguitySignals"];
    negationSpans: string[];
    modalOperators: string[];
    quantifierSignals: string[];
    scopeFragility: number;
  };
  discourse: {
    sentenceCount: number;
    fragmentDetected: boolean;
    rhetoricalQuestionDetected: boolean;
    repetitionDetected: boolean;
    repetitionSegments: string[];
    discourseMarkers: string[];
    topicShiftDetected: boolean;
    repairSignals: LanguageState["discourseRepairSignals"];
    dialogueShape: LanguageState["discourse"]["dialogueShape"];
  };
  stylistic: {
    tone: LanguageState["tone"];
    register: LanguageState["register"];
    emotionalTone: LanguageState["emotionalTone"];
    urgency: LanguageState["urgency"];
    frustrationScore: number;
    confidenceStyle: LanguageState["stylistic"]["confidenceStyle"];
    hesitationScore: number;
    insistenceScore: number;
    affectivePolarity: LanguageState["stylistic"]["affectivePolarity"];
  };
}

export function languageStateBuilder(input: LanguageStateBuilderInput): LanguageState {
  return {
    semanticFocus: input.semantic.semanticFocus,
    primaryIntent: input.semantic.primaryIntent,
    ambiguity: input.semantic.ambiguity,
    speechAct: input.pragmatic.speechAct,
    politeness: input.pragmatic.politeness,
    tone: input.stylistic.tone,
    register: input.stylistic.register,
    mixedLanguage: input.language.mixedLanguage,
    stabilizedText: input.stabilizedText,
    dominantLanguage: input.language.dominantLanguage,
    locale: input.language.locale,
    languageConfidence: input.language.confidence,
    pragmaticIntent: input.pragmatic.intent,
    referentialMarkers: input.semantic.referentialMarkers,
    ambiguitySignals: input.semantic.ambiguitySignals,
    repetitionDetected: input.discourse.repetitionDetected,
    emotionalTone: input.stylistic.emotionalTone,
    urgency: input.stylistic.urgency,
    discourseRepairSignals: input.discourse.repairSignals,
    language: {
      dominantLanguage: input.language.dominantLanguage,
      locale: input.language.locale,
      dialectHints: input.language.dialectHints,
      mixedLanguage: input.language.mixedLanguage,
      languageSwitches: input.language.languageSwitches,
      confidence: input.language.confidence,
    },
    normalization: {
      sourceText: input.sourceText,
      stabilizedText: input.stabilizedText,
      canonicalText: input.canonicalText,
      steps: input.normalizationSteps,
    },
    pragmatic: {
      speechAct: input.pragmatic.speechAct,
      intent: input.pragmatic.intent,
      politeness: input.pragmatic.politeness,
      indirectRequest: input.pragmatic.indirectRequest,
      directiveForce: input.pragmatic.directiveForce,
      emphasisStrength: input.pragmatic.emphasisStrength,
      implicatureSignals: input.pragmatic.implicatureSignals,
      relationalCues: input.pragmatic.relationalCues,
    },
    semantic: {
      semanticFocus: input.semantic.semanticFocus,
      primaryIntent: input.semantic.primaryIntent,
      keywordAnchors: input.semantic.keywordAnchors,
      entities: input.semantic.entities,
      referentialMarkers: input.semantic.referentialMarkers,
      ambiguitySignals: input.semantic.ambiguitySignals,
      ambiguityScore: input.semantic.ambiguity,
      negationSpans: input.semantic.negationSpans,
      modalOperators: input.semantic.modalOperators,
      quantifierSignals: input.semantic.quantifierSignals,
      scopeFragility: input.semantic.scopeFragility,
    },
    discourse: {
      sentenceCount: input.discourse.sentenceCount,
      fragmentDetected: input.discourse.fragmentDetected,
      rhetoricalQuestionDetected: input.discourse.rhetoricalQuestionDetected,
      repetitionDetected: input.discourse.repetitionDetected,
      repetitionSegments: input.discourse.repetitionSegments,
      discourseMarkers: input.discourse.discourseMarkers,
      topicShiftDetected: input.discourse.topicShiftDetected,
      repairSignals: input.discourse.repairSignals,
      dialogueShape: input.discourse.dialogueShape,
    },
    stylistic: {
      tone: input.stylistic.tone,
      register: input.stylistic.register,
      emotionalTone: input.stylistic.emotionalTone,
      urgency: input.stylistic.urgency,
      frustrationScore: input.stylistic.frustrationScore,
      confidenceStyle: input.stylistic.confidenceStyle,
      hesitationScore: input.stylistic.hesitationScore,
      insistenceScore: input.stylistic.insistenceScore,
      affectivePolarity: input.stylistic.affectivePolarity,
    },
    auditTrail: [
      { stage: "language-detection", decision: input.language.locale, score: input.language.confidence },
      { stage: "normalization", decision: "stabilized_text_generated", score: input.normalizationSteps.filter((step) => step.changed).length },
      { stage: "pragmatic", decision: `${input.pragmatic.speechAct}/${input.pragmatic.intent}`, score: input.pragmatic.directiveForce },
      { stage: "semantic-surface", decision: input.semantic.semanticFocus, score: input.semantic.ambiguity },
      { stage: "discourse-form", decision: input.discourse.dialogueShape, score: Number(input.discourse.repetitionDetected) },
      { stage: "stylistic-affective", decision: input.stylistic.emotionalTone, score: input.stylistic.frustrationScore },
    ],
  };
}

