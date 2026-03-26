/**
 * Responsabilidade do arquivo:
 * - Analisar postura evidencial de cada claim (suporte, contraste, lacuna).
 * - Reaproveitar evidencias recuperadas no pipeline, sem duplicar retrieval.
 * - Entregar sinais para incerteza e score epistemico.
 */
import type { EpistemicClaim } from "./epistemic-claim-classifier";

export interface EvidenceStanceRow {
  claimId: string;
  supportScore: number;
  contrastScore: number;
  gapScore: number;
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lexicalOverlap(left: string, right: string) {
  const leftTokens = new Set(normalize(left).split(" ").filter((token) => token.length >= 4));
  if (!leftTokens.size) return 0;
  const rightTokens = new Set(normalize(right).split(" ").filter((token) => token.length >= 4));
  if (!rightTokens.size) return 0;
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  return clamp01(overlap / Math.max(2, leftTokens.size));
}

export function analyzeEvidenceStance(claims: EpistemicClaim[], evidence: string[]): EvidenceStanceRow[] {
  return claims.map((claim) => {
    const supportScore = evidence.reduce((max, row) => Math.max(max, lexicalOverlap(claim.text, row)), 0);
    const contrastScore = evidence.reduce((max, row) => {
      const hasContrastCue = /\b(mas|porem|contudo|entretanto|contradiz|inconsistente)\b/i.test(row);
      if (!hasContrastCue) return max;
      return Math.max(max, lexicalOverlap(claim.text, row));
    }, 0);
    const gapScore = clamp01(1 - supportScore);
    return {
      claimId: claim.id,
      supportScore,
      contrastScore,
      gapScore,
    };
  });
}

