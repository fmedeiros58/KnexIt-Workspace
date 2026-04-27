/**
 * @file claim-evidence-aligner.ts
 * @description Alinha claims candidatos com unidades de evidencia.
 * @layer 13-epistemic-integration-layer
 * @purpose Apoiar grounding e reduzir overclaim na integracao epistemica.
 * @inputs Claims textuais e evidencias recuperadas.
 * @outputs Pares claim-evidence com score.
 * @dependsOn evidence-unit.
 * @usedBy integracao epistemica, validacao e auditoria.
 * @invariants Claims sem evidencia devem permanecer sem alinhamento, nao ser preenchidos artificialmente.
 * @notes Usa sobreposicao lexical leve para baixo custo.
 */
import type { EvidenceUnit } from "../../bridges/contracts/evidence-unit";

export function alignClaimsToEvidence(claims: string[], evidence: EvidenceUnit[]): Array<{ claim: string; evidenceId: string | null; score: number }> {
  return claims.map((claim) => {
    const claimTerms = new Set(claim.toLowerCase().split(/\W+/).filter((term) => term.length > 4));
    let best: { evidenceId: string | null; score: number } = { evidenceId: null, score: 0 };
    for (const unit of evidence) {
      const overlap = unit.text.toLowerCase().split(/\W+/).filter((term) => claimTerms.has(term)).length;
      const score = Number((overlap / Math.max(1, claimTerms.size)).toFixed(4));
      if (score > best.score) best = { evidenceId: unit.id, score };
    }
    return { claim, ...best };
  });
}

