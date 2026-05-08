/**
 * @file competing-hypothesis-builder.ts
 * @description Constroi hipoteses concorrentes simples para interpretacao de tarefa.
 * @layer 08-quantum-information-state-layer
 * @purpose Apoiar competicao de leituras sem acoplar ao orquestrador.
 * @inputs Texto normalizado e rotulos candidatos.
 * @outputs Lista de hipoteses canonicas.
 * @dependsOn hypothesis.
 * @usedBy camada QIS e testes de continuidade cognitiva.
 * @invariants Hipoteses devem ser marcadas como candidatas, nao conclusoes.
 * @notes Operador leve para tarefas com ambiguidade interpretativa.
 */
import type { Hypothesis } from "../../bridges/contracts/hypothesis";

export function buildCompetingHypotheses(text: string, labels: string[]): Hypothesis[] {
  return labels.slice(0, 5).map((label, index) => ({
    id: `hypothesis-${index + 1}`,
    label,
    statement: `${label}: ${text.slice(0, 180)}`,
    score: Number((1 / (index + 1)).toFixed(4)),
    evidence: [],
    assumptions: [],
    risks: [],
  }));
}

