/**
 * Responsabilidade do arquivo:
 * - Definir politica de orçamento de latencia por rota do pipeline.
 * - Estabelecer cutoffs por camada pesada para gates de execucao.
 * - Servir de fonte unica para balancing e latency gates.
 */
import type { PipelineRoute } from "../shared/enums/pipeline-enums";

export interface LatencyPolicy {
  maxBudgetMs: number;
  knowledgeCutoffMs: number;
  reflectiveCutoffMs: number;
  inferentialCutoffMs: number;
  quantumCutoffMs: number;
  academicCutoffMs: number;
}

export const LATENCY_POLICY_BY_ROUTE: Record<PipelineRoute, LatencyPolicy> = {
  minimum: {
    maxBudgetMs: 800,
    knowledgeCutoffMs: 250,
    reflectiveCutoffMs: 350,
    inferentialCutoffMs: 350,
    quantumCutoffMs: 350,
    academicCutoffMs: 500,
  },
  reflective: {
    maxBudgetMs: 1600,
    knowledgeCutoffMs: 500,
    reflectiveCutoffMs: 900,
    inferentialCutoffMs: 900,
    quantumCutoffMs: 900,
    academicCutoffMs: 1100,
  },
  inferential: {
    maxBudgetMs: 2600,
    knowledgeCutoffMs: 900,
    reflectiveCutoffMs: 1400,
    inferentialCutoffMs: 1800,
    quantumCutoffMs: 1800,
    academicCutoffMs: 2100,
  },
  "quantum-state": {
    maxBudgetMs: 4200,
    knowledgeCutoffMs: 1300,
    reflectiveCutoffMs: 2100,
    inferentialCutoffMs: 2800,
    quantumCutoffMs: 3200,
    academicCutoffMs: 3500,
  },
};
