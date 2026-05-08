/**
 * @file hypothesis-pruner.ts
 * @description Poda hipoteses concorrentes por score minimo.
 * @layer 08-quantum-information-state-layer
 * @purpose Reduzir ruido mantendo rastreabilidade de hipoteses descartadas.
 * @inputs Lista de hipoteses e limite minimo.
 * @outputs Hipoteses mantidas e ids podados.
 * @dependsOn hypothesis.
 * @usedBy camada QIS e auditoria.
 * @invariants A poda deve preservar pelo menos uma hipotese quando houver entrada.
 * @notes O operador nao altera pesos globais do estado quantico legado.
 */
import type { Hypothesis } from "../../bridges/contracts/hypothesis";

export function pruneHypotheses(hypotheses: Hypothesis[], minimumScore = 0.25): { kept: Hypothesis[]; prunedIds: string[] } {
  const kept = hypotheses.filter((item) => item.score >= minimumScore);
  const safeKept = kept.length ? kept : hypotheses.slice(0, 1);
  return {
    kept: safeKept,
    prunedIds: hypotheses.filter((item) => !safeKept.some((keptItem) => keptItem.id === item.id)).map((item) => item.id),
  };
}

