/**
 * Responsabilidade do arquivo:
 * - Traduzir risco/coverage epistemica em sinais comunicaveis de incerteza.
 * - Preservar transparencia sem colapsar resposta em indecisao.
 * - Fornecer notas curtas para generation/presentation.
 */
import type { EvidenceStanceRow } from "./evidence-stance-analyzer";

export function buildUncertaintySignals(input: {
  overclaimRisk: number;
  stanceRows: EvidenceStanceRow[];
  extrapolationFlags: string[];
}) {
  const avgGap =
    input.stanceRows.length > 0
      ? input.stanceRows.reduce((sum, row) => sum + row.gapScore, 0) / input.stanceRows.length
      : 1;

  const signals: string[] = [];
  if (input.overclaimRisk >= 0.66) signals.push("incerteza_alta_por_risco_de_extrapolacao");
  else if (input.overclaimRisk >= 0.42) signals.push("incerteza_moderada_requer_cautela");
  else signals.push("incerteza_controlada");

  if (avgGap >= 0.58) signals.push("cobertura_evidencial_parcial");
  if (input.extrapolationFlags.length > 0) signals.push(`flags=${input.extrapolationFlags.join(",")}`);

  return {
    avgGap,
    signals,
  };
}

