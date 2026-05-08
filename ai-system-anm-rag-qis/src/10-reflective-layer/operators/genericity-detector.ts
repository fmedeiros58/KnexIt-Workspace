/**
 * @file genericity-detector.ts
 * @description Detecta resposta excessivamente generica para a tarefa.
 * @layer 10-reflective-layer
 * @purpose Sinalizar quando a resposta nao ancora nos termos essenciais do pedido.
 * @inputs Pergunta e resposta candidata.
 * @outputs Resultado de genericidade.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy validacao por classe e autocritica.
 * @invariants Genericidade nao deve penalizar respostas curtas corretas.
 * @notes Penaliza texto longo com baixa sobreposicao lexical.
 */
export function detectGenericity(question: string, answer: string): { generic: boolean; score: number; reasons: string[] } {
  const questionTerms = new Set(question.toLowerCase().split(/\W+/).filter((term) => term.length > 4));
  const answerTerms = new Set(answer.toLowerCase().split(/\W+/).filter((term) => term.length > 4));
  const overlap = [...questionTerms].filter((term) => answerTerms.has(term)).length;
  const score = Number((overlap / Math.max(1, questionTerms.size)).toFixed(4));
  const generic = answer.length > 400 && score < 0.18;
  return { generic, score, reasons: generic ? ["low_question_answer_overlap"] : [] };
}

