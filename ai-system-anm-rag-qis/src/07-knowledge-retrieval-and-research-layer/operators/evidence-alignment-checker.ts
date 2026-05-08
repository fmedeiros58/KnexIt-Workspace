/**
 * @file evidence-alignment-checker.ts
 * @description Verifica alinhamento simples entre claims de resposta e evidencias recuperadas.
 * @layer 07-knowledge-retrieval-and-research-layer
 * @purpose Sinalizar quando uma analise grounded nao usa evidencia disponivel.
 * @inputs Resposta candidata e evidencias recuperadas.
 * @outputs Resultado de alinhamento.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy validacao epistemica e auditoria de retrieval.
 * @invariants Nao deve inventar evidencia nem citar fonte ausente.
 * @notes Usa sobreposicao lexical leve para custo baixo.
 */
export function checkEvidenceAlignment(answer: string, evidence: string[]): { aligned: boolean; score: number; issues: string[] } {
  if (!evidence.length) return { aligned: false, score: 0, issues: ["evidence_missing"] };
  const answerTerms = new Set(`${answer || ""}`.toLowerCase().split(/\W+/).filter((term) => term.length > 4));
  const evidenceTerms = new Set(evidence.join(" ").toLowerCase().split(/\W+/).filter((term) => term.length > 4));
  const overlap = [...answerTerms].filter((term) => evidenceTerms.has(term)).length;
  const score = Number(Math.min(1, overlap / Math.max(6, answerTerms.size * 0.18)).toFixed(4));
  return { aligned: score >= 0.28, score, issues: score >= 0.28 ? [] : ["low_claim_evidence_overlap"] };
}

