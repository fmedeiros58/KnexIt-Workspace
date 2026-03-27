/**
 * Responsabilidade do arquivo:
 * - Detectar contradicoes internas entre claims ou entre claim e evidencia.
 * - Reforcar robustez da camada 17 com auditoria semantica basica.
 * - Sinalizar inconsistencias para veredito final de validacao.
 */
import type { EpistemicClaim } from "../13-epistemic-integration-layer/epistemic-claim-classifier";

const NEGATION_CUE = /\b(nao|nunca|jamais|sem)\b/i;

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectEpistemicContradictions(claims: EpistemicClaim[], evidence: string[]) {
  const issues: string[] = [];
  const normalizedClaims = claims.map((claim) => normalize(claim.text));
  for (let i = 0; i < normalizedClaims.length; i += 1) {
    for (let j = i + 1; j < normalizedClaims.length; j += 1) {
      const left = normalizedClaims[i];
      const right = normalizedClaims[j];
      if (!left || !right) continue;
      const sharedAnchor = left.split(" ").filter((token) => token.length >= 5).some((token) => right.includes(token));
      if (!sharedAnchor) continue;
      if (NEGATION_CUE.test(left) !== NEGATION_CUE.test(right)) {
        issues.push(`claim_contradiction:${claims[i].id}:${claims[j].id}`);
      }
    }
  }

  const contradictionFromEvidence = evidence.some((row) => /\b(contradiz|inconsistente|conflitante)\b/i.test(row));
  if (contradictionFromEvidence) issues.push("evidence_declares_conflict");

  return {
    hasContradiction: issues.length > 0,
    issues,
  };
}

