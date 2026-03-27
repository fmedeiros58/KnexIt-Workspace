/**
 * Responsabilidade do arquivo:
 * - Consolidar veredito epistemico final da auditoria da camada 17.
 * - Unificar cobertura, contradicoes e competicao de hipoteses.
 * - Fornecer decisao simples para consumo em validationReport.
 */
export interface EpistemicValidationVerdict {
  ok: boolean;
  score: number;
  issues: string[];
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function buildEpistemicValidationVerdict(input: {
  coverage: number;
  contradictionCount: number;
  hypothesisCompetitionOk: boolean;
  unsupportedClaims: number;
}): EpistemicValidationVerdict {
  const base = (input.coverage * 0.58) - (input.contradictionCount * 0.18) - (input.unsupportedClaims * 0.12);
  const score = clamp01(base + (input.hypothesisCompetitionOk ? 0.14 : -0.08));

  const issues: string[] = [];
  if (input.coverage < 0.55) issues.push("support_coverage_low");
  if (input.contradictionCount > 0) issues.push("contradictions_detected");
  if (!input.hypothesisCompetitionOk) issues.push("hypothesis_competition_insufficient");
  if (input.unsupportedClaims > 0) issues.push("unsupported_claims_detected");

  return {
    ok: issues.length === 0,
    score,
    issues,
  };
}

