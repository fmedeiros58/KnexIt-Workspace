/**
 * @file interpretation-competition.ts
 * @description Resolve competicao simples entre interpretacoes candidatas.
 * @layer 08-quantum-information-state-layer
 * @purpose Escolher uma hipotese dominante mantendo score de competicao.
 * @inputs Hipoteses candidatas.
 * @outputs Dominante e score de competicao.
 * @dependsOn hypothesis.
 * @usedBy camada QIS e auditoria.
 * @invariants A interpretacao dominante deve vir da lista recebida.
 * @notes Empates indicam competicao alta e podem acionar reflexao.
 */
import type { Hypothesis } from "../../bridges/contracts/hypothesis";

export function competeInterpretations(hypotheses: Hypothesis[]): { dominant: Hypothesis | null; competitionScore: number } {
  const sorted = [...hypotheses].sort((left, right) => right.score - left.score);
  const dominant = sorted[0] || null;
  const runnerUp = sorted[1];
  const gap = dominant && runnerUp ? Math.max(0, dominant.score - runnerUp.score) : 1;
  return { dominant, competitionScore: Number((1 - Math.min(1, gap)).toFixed(4)) };
}

