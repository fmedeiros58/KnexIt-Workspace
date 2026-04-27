/**
 * @file hypothesis-set.ts
 * @description Define um conjunto auditavel de hipoteses concorrentes.
 * @layer bridges/contracts
 * @purpose Representar competicao, poda e hipotese dominante de forma estruturada.
 * @inputs Hipoteses candidatas, regras de poda e sinais de evidencia.
 * @outputs HypothesisSet.
 * @dependsOn hypothesis.
 * @usedBy camada QIS, reflexao, inferencia, integracao epistemica e auditoria.
 * @invariants A hipotese dominante deve existir dentro do conjunto quando declarada.
 * @notes O campo prunedHypothesisIds preserva rastreabilidade sem manter carga textual.
 */
import type { Hypothesis } from "./hypothesis";

export interface HypothesisSet {
  hypotheses: Hypothesis[];
  dominantHypothesisId: string | null;
  prunedHypothesisIds: string[];
  competitionScore: number;
  auditReasons: string[];
}

