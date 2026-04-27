/**
 * @file implication-tester.ts
 * @description Testa implicacao textual simples entre premissa e conclusao.
 * @layer 11-inferential-layer
 * @purpose Sinalizar saltos inferenciais obvios antes da integracao epistemica.
 * @inputs Premissa e conclusao.
 * @outputs Resultado de teste de implicacao.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy inferencia, reflexao e auditoria.
 * @invariants Resultado e heuristico e nao prova formal.
 * @notes Sobreposicao lexical baixa indica necessidade de ponte explicativa.
 */
export function testImplication(premise: string, conclusion: string): { plausible: boolean; score: number; issues: string[] } {
  const premiseTerms = new Set(premise.toLowerCase().split(/\W+/).filter((term) => term.length > 4));
  const conclusionTerms = conclusion.toLowerCase().split(/\W+/).filter((term) => term.length > 4);
  const overlap = conclusionTerms.filter((term) => premiseTerms.has(term)).length;
  const score = Number((overlap / Math.max(1, conclusionTerms.length)).toFixed(4));
  return { plausible: score >= 0.2, score, issues: score >= 0.2 ? [] : ["low_premise_conclusion_overlap"] };
}

