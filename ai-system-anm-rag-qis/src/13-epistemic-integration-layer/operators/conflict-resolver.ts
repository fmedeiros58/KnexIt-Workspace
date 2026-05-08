/**
 * @file conflict-resolver.ts
 * @description Resolve conflitos epistemicos simples por prioridade de evidencia.
 * @layer 13-epistemic-integration-layer
 * @purpose Registrar se conflitos devem ser apresentados, reduzidos ou bloqueados.
 * @inputs Lista de conflitos e score de evidencia.
 * @outputs Decisao de conflito.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy integracao epistemica, validacao e auditoria.
 * @invariants Nao deve apagar conflitos de alta severidade.
 * @notes Complementa conflict-consolidator legado com nome canonico solicitado.
 */
export function resolveEpistemicConflicts(conflicts: string[], evidenceScore: number): {
  action: "none" | "mention" | "block";
  reasons: string[];
} {
  if (!conflicts.length) return { action: "none", reasons: [] };
  if (evidenceScore < 0.35) return { action: "block", reasons: ["low_evidence_with_conflicts", ...conflicts.slice(0, 3)] };
  return { action: "mention", reasons: conflicts.slice(0, 3) };
}

