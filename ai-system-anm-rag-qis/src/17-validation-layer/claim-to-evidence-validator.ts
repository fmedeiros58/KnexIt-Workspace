/**
 * Responsabilidade do arquivo:
 * - Validar relacao claim->evidence com base em sobreposicao lexical util.
 * - Sinalizar claims sem lastro suficiente nas evidencias recuperadas.
 * - Fornecer metrica simples e estavel para veredito epistemico.
 */
import type { EpistemicClaim } from "../13-epistemic-integration-layer/epistemic-claim-classifier";

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function overlap(left: string, right: string) {
  const leftTokens = new Set(normalize(left).split(" ").filter((token) => token.length >= 4));
  if (!leftTokens.size) return 0;
  const rightTokens = new Set(normalize(right).split(" ").filter((token) => token.length >= 4));
  if (!rightTokens.size) return 0;
  let hit = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) hit += 1;
  }
  return hit / Math.max(2, leftTokens.size);
}

export interface ClaimEvidenceValidationRow {
  claimId: string;
  support: number;
  supported: boolean;
}

export function validateClaimsAgainstEvidence(claims: EpistemicClaim[], evidence: string[]): ClaimEvidenceValidationRow[] {
  return claims.map((claim) => {
    const support = evidence.reduce((max, item) => Math.max(max, overlap(claim.text, item)), 0);
    return {
      claimId: claim.id,
      support,
      supported: support >= 0.22 || claim.kind === "open_question",
    };
  });
}

