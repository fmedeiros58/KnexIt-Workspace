/**
 * Responsabilidade do arquivo:
 * - Padronizar o LanguageState final (ranges, listas unicas e defaults estaveis).
 * - Reduzir variacao estrutural antes da validacao e do handoff.
 * - Garantir consistencia de campos derivados para auditoria.
 */
import type { LanguageState } from "./types/language-types";
import { dedupeList, clamp01 } from "./utils/normalization-utils";

export function languageStateNormalizer(state: LanguageState): LanguageState {
  return {
    ...state,
    ambiguity: clamp01(state.ambiguity),
    politeness: clamp01(state.politeness),
    languageConfidence: clamp01(state.languageConfidence),
    ambiguitySignals: state.ambiguitySignals.slice(0, 16),
    referentialMarkers: state.referentialMarkers.slice(0, 16),
    discourseRepairSignals: state.discourseRepairSignals.slice(0, 12),
    language: {
      ...state.language,
      confidence: clamp01(state.language.confidence),
      dialectHints: dedupeList(state.language.dialectHints).slice(0, 10),
      languageSwitches: state.language.languageSwitches.slice(0, 10),
    },
    pragmatic: {
      ...state.pragmatic,
      politeness: clamp01(state.pragmatic.politeness),
      directiveForce: clamp01(state.pragmatic.directiveForce),
      emphasisStrength: clamp01(state.pragmatic.emphasisStrength),
      implicatureSignals: dedupeList(state.pragmatic.implicatureSignals).slice(0, 12),
      relationalCues: dedupeList(state.pragmatic.relationalCues).slice(0, 12),
    },
    semantic: {
      ...state.semantic,
      ambiguityScore: clamp01(state.semantic.ambiguityScore),
      scopeFragility: clamp01(state.semantic.scopeFragility),
      keywordAnchors: dedupeList(state.semantic.keywordAnchors).slice(0, 16),
      entities: dedupeList(state.semantic.entities).slice(0, 16),
      negationSpans: dedupeList(state.semantic.negationSpans).slice(0, 12),
      modalOperators: dedupeList(state.semantic.modalOperators).slice(0, 12),
      quantifierSignals: dedupeList(state.semantic.quantifierSignals).slice(0, 12),
    },
    discourse: {
      ...state.discourse,
      repetitionSegments: dedupeList(state.discourse.repetitionSegments).slice(0, 8),
      discourseMarkers: dedupeList(state.discourse.discourseMarkers).slice(0, 12),
      repairSignals: state.discourse.repairSignals.slice(0, 12),
    },
    stylistic: {
      ...state.stylistic,
      frustrationScore: clamp01(state.stylistic.frustrationScore),
      hesitationScore: clamp01(state.stylistic.hesitationScore),
      insistenceScore: clamp01(state.stylistic.insistenceScore),
    },
  };
}

