/**
 * @file premise-gap-detector.ts
 * @description Detecta lacunas de premissa entre pergunta e resposta candidata.
 * @layer 10-reflective-layer
 * @purpose Apoiar autocritica curta e reduzir aceitacao prematura.
 * @inputs Pergunta, resposta e restricoes explicitas.
 * @outputs Lista de lacunas detectadas.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy validacao, reflexao e auditoria.
 * @invariants Nao deve inventar premissas ausentes.
 * @notes Heuristica lexical para uso local.
 */
export function detectPremiseGaps(question: string, answer: string, constraints: string[] = []): string[] {
  const gaps: string[] = [];
  if (constraints.length && !constraints.some((constraint) => answer.toLowerCase().includes(constraint.toLowerCase().slice(0, 18)))) {
    gaps.push("explicit_constraints_not_referenced");
  }
  if (/\b(todas?.*errad|restri[cç][aã]o|apenas)\b/i.test(question) && !/\b(restri[cç][aã]o|etiqueta|errad|apenas)\b/i.test(answer)) {
    gaps.push("key_constraint_terms_missing");
  }
  return gaps;
}

