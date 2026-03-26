/**
 * Responsabilidade do arquivo:
 * - Calcular confianca epistemica consolidada a partir de claims, stance e riscos.
 * - Penalizar extrapolacao sem ignorar suporte real quando existente.
 * - Entregar score unico para integracao e validacao.
 */
import type { EpistemicClaim } from "./epistemic-claim-classifier";
import type { EvidenceStanceRow } from "./evidence-stance-analyzer";

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function scoreEpistemicConfidence(input: {
  claims: EpistemicClaim[];
  stanceRows: EvidenceStanceRow[];
  overclaimRisk: number;
}) {
  const avgClaimConfidence =
    input.claims.length > 0
      ? input.claims.reduce((sum, row) => sum + row.confidence, 0) / input.claims.length
      : 0.45;
  const avgSupport =
    input.stanceRows.length > 0
      ? input.stanceRows.reduce((sum, row) => sum + row.supportScore, 0) / input.stanceRows.length
      : 0;
  const avgContrast =
    input.stanceRows.length > 0
      ? input.stanceRows.reduce((sum, row) => sum + row.contrastScore, 0) / input.stanceRows.length
      : 0;

  return clamp01(
    (avgClaimConfidence * 0.42) +
      (avgSupport * 0.42) -
      (avgContrast * 0.14) -
      (input.overclaimRisk * 0.32),
  );
}

