/**
 * Responsabilidade do arquivo:
 * - Resolver semantica de superficie integrando pistas locais de sentido.
 * - Nao fazer semantica profunda/inferencial; apenas classificar foco e intencao primaria local.
 * - Produzir resumo semantico auditavel para o LanguageState.
 */
import { surfaceSemanticAggregation } from "./surface-semantic-aggregation";

export interface MeaningResolutionInput {
  text: string;
}

export interface MeaningResolution {
  primaryIntent: string;
  semanticFocus: string;
  ambiguity: number;
  keywordAnchors: string[];
  entities: string[];
  referentialMarkers: ReturnType<typeof surfaceSemanticAggregation>["referentialMarkers"];
  ambiguitySignals: ReturnType<typeof surfaceSemanticAggregation>["ambiguitySignals"];
  negationSpans: string[];
  modalOperators: string[];
  quantifierSignals: string[];
  scopeFragility: number;
}

function inferPrimaryIntent(text: string): string {
  const lowered = text.toLowerCase();
  if (/\b(implemente|crie|ajuste|corrija|refatore|build|fix)\b/.test(lowered)) return "task";
  if (/\?$/.test(lowered) || /\b(como|qual|who|what|how|why)\b/.test(lowered)) return "question";
  if (/\b(meu nome|my name|me chame|call me)\b/.test(lowered)) return "identity";
  return "chat";
}

function inferSemanticFocus(text: string, primaryIntent: string): string {
  if (primaryIntent === "identity") return "identity";
  if (primaryIntent === "task") return "execution";
  if (primaryIntent === "question") return "inquiry";
  if (/\b(contrato|interface|tipo|payload|bridge)\b/.test(text.toLowerCase())) return "architecture";
  return "conversation";
}

export function meaningResolver(input: MeaningResolutionInput): MeaningResolution {
  const aggregated = surfaceSemanticAggregation({ text: input.text });
  const primaryIntent = inferPrimaryIntent(input.text);
  const semanticFocus = inferSemanticFocus(input.text, primaryIntent);

  return {
    primaryIntent,
    semanticFocus,
    ambiguity: aggregated.ambiguityScore,
    keywordAnchors: aggregated.keywordAnchors,
    entities: aggregated.entities,
    referentialMarkers: aggregated.referentialMarkers,
    ambiguitySignals: aggregated.ambiguitySignals,
    negationSpans: aggregated.negationSpans,
    modalOperators: aggregated.modalOperators,
    quantifierSignals: aggregated.quantifierSignals,
    scopeFragility: aggregated.scopeFragility,
  };
}

