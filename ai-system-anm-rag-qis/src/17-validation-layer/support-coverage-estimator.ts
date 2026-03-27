/**
 * Responsabilidade do arquivo:
 * - Estimar cobertura factual de suporte para claims da resposta.
 * - Transformar suporte individual em indicador agregado de cobertura.
 * - Oferecer sinal objetivo para veredito epistemico.
 */
import type { ClaimEvidenceValidationRow } from "./claim-to-evidence-validator";

export function estimateSupportCoverage(rows: ClaimEvidenceValidationRow[]) {
  if (!rows.length) {
    return {
      supportedCount: 0,
      totalClaims: 0,
      coverage: 0,
    };
  }

  const supportedCount = rows.filter((row) => row.supported).length;
  const coverage = supportedCount / rows.length;

  return {
    supportedCount,
    totalClaims: rows.length,
    coverage,
  };
}

