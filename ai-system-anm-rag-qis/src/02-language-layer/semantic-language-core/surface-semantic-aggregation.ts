/**
 * Responsabilidade do arquivo:
 * - Consolidar sinais semanticos de superficie em bloco unificado.
 * - Reaproveitar snapshot textual quando disponivel.
 * - Entregar estrutura pronta para meaning-resolver.
 */
import type { TextAnalysisSnapshot } from "../../shared/text-processing/text-analysis-snapshot";
import { ambiguitySignalDetector } from "./ambiguity-signal-detector";
import { entitySurfaceExtractor } from "./entity-surface-extractor";
import { keywordAnchorExtractor } from "./keyword-anchor-extractor";
import { modalOperatorDetector } from "./modal-operator-detector";
import { negationScopeDetector } from "./negation-scope-detector";
import { quantifierSignalDetector } from "./quantifier-signal-detector";
import { referentialMarkerDetector } from "./referential-marker-detector";
import { scopeFragilityDetector } from "./scope-fragility-detector";

export interface SurfaceSemanticAggregationInput {
  text: string;
  snapshot?: TextAnalysisSnapshot;
}

export interface SurfaceSemanticAggregationResult {
  keywordAnchors: string[];
  entities: string[];
  referentialMarkers: ReturnType<typeof referentialMarkerDetector>["markers"];
  ambiguitySignals: ReturnType<typeof ambiguitySignalDetector>["signals"];
  ambiguityScore: number;
  negationSpans: string[];
  modalOperators: string[];
  quantifierSignals: string[];
  scopeFragility: number;
}

export function surfaceSemanticAggregation(input: SurfaceSemanticAggregationInput): SurfaceSemanticAggregationResult {
  const text = input.snapshot?.normalizedText || input.text;

  const anchors = keywordAnchorExtractor({ text });
  const entities = entitySurfaceExtractor({ text });
  const referential = referentialMarkerDetector({ text });
  const ambiguity = ambiguitySignalDetector({ text });
  const negation = negationScopeDetector({ text });
  const modal = modalOperatorDetector({ text });
  const quantifier = quantifierSignalDetector({ text });
  const fragility = scopeFragilityDetector({ text, ambiguityScore: ambiguity.score });

  return {
    keywordAnchors: anchors.anchors,
    entities: entities.entities,
    referentialMarkers: referential.markers,
    ambiguitySignals: ambiguity.signals,
    ambiguityScore: ambiguity.score,
    negationSpans: negation.negationSpans,
    modalOperators: modal.operators,
    quantifierSignals: quantifier.quantifiers,
    scopeFragility: fragility.fragility,
  };
}
