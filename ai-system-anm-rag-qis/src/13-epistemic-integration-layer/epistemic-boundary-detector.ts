/**
 * Responsabilidade do arquivo:
 * - Detectar extrapolacao, overclaim e fronteiras de validade das afirmacoes.
 * - Sinalizar quando a resposta ultrapassa o suporte evidencial disponivel.
 * - Gerar riscos epistemicos acionaveis para o orquestrador da camada 13.
 */
import type { EpistemicClaim } from "./epistemic-claim-classifier";

export interface EpistemicBoundaryAssessment {
  extrapolationFlags: string[];
  overclaimRisk: number;
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function detectEpistemicBoundaries(
  claims: EpistemicClaim[],
  evidenceCount: number,
): EpistemicBoundaryAssessment {
  const extrapolationFlags: string[] = [];
  const absoluteClaims = claims.filter((claim) => /\b(sempre|nunca|absoluto|definitivo|100%)\b/i.test(claim.text));
  if (absoluteClaims.length) extrapolationFlags.push("absolute_language_detected");

  const factClaims = claims.filter((claim) => claim.kind === "fact").length;
  if (factClaims > 0 && evidenceCount === 0) extrapolationFlags.push("fact_without_evidence");
  if (factClaims > evidenceCount + 2) extrapolationFlags.push("fact_density_above_evidence_coverage");

  const speculativeClaims = claims.filter((claim) => claim.kind === "speculation").length;
  if (speculativeClaims >= Math.max(2, Math.ceil(claims.length * 0.35))) {
    extrapolationFlags.push("speculation_ratio_high");
  }

  const overclaimRisk = clamp01(
    (absoluteClaims.length * 0.18) +
      (factClaims > evidenceCount ? 0.26 : 0) +
      (speculativeClaims / Math.max(1, claims.length)) * 0.42,
  );

  return { extrapolationFlags, overclaimRisk };
}

