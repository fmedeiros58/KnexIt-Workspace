/**
 * Responsabilidade do arquivo:
 * - Definir interfaces internas de processadores do 02-language-layer.
 * - Padronizar assinaturas para facilitar composicao e substituicao de detectores.
 * - Permitir auditoria de fluxo por contratos claros de entrada/saida.
 */
import type { LanguageNormalizationState } from "../types/language-types";

export interface TextProcessor<I, O> {
  (input: I): O;
}

export interface DetectorInput {
  text: string;
}

export interface NormalizerInput {
  text: string;
}

export interface NormalizerOutput extends LanguageNormalizationState {}

export interface AggregatorInput<T> {
  text: string;
  parts: T[];
}

export interface AggregatorOutput {
  summary: string;
  confidence: number;
}


