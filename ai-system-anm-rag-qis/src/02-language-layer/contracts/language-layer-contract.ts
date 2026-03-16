/**
 * Responsabilidade do arquivo:
 * - Definir contrato do orquestrador principal da camada de linguagem.
 * - Declarar ordem esperada dos estagios para rastreabilidade do pipeline.
 * - Servir como referencia formal para evolucao sem quebrar handoff.
 */
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export type LanguageLayerStage =
  | "language-detection"
  | "normalization"
  | "pragmatic"
  | "semantic-surface"
  | "discourse-form"
  | "stylistic-affective"
  | "state-consolidation"
  | "trace";

export const LANGUAGE_LAYER_STAGE_ORDER: ReadonlyArray<LanguageLayerStage> = [
  "language-detection",
  "normalization",
  "pragmatic",
  "semantic-surface",
  "discourse-form",
  "stylistic-affective",
  "state-consolidation",
  "trace",
] as const;

export interface LanguageLayerRunner {
  (state: ProcessingState): Promise<ProcessingState>;
}


