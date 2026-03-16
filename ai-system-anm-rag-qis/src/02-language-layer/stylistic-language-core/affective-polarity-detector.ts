/**
 * Responsabilidade do arquivo:
 * - Determinar polaridade afetiva geral (negative, neutral, mixed, positive).
 * - Combinar contagens lexicais positivas e negativas de forma transparente.
 * - Expor resultado simples para handoff e auditoria.
 */
import type { AffectivePolarityType } from "../types/language-signal-types";

export interface AffectivePolarityDetectorInput {
  text: string;
}

export interface AffectivePolarityDetectorResult {
  polarity: AffectivePolarityType;
}

export function affectivePolarityDetector(input: AffectivePolarityDetectorInput): AffectivePolarityDetectorResult {
  const text = `${input.text || ""}`.toLowerCase();
  const positive = (text.match(/\b(otimo|bom|excelente|obrigado|perfeito|funcionou)\b/g) || []).length;
  const negative = (text.match(/\b(ruim|pessimo|erro|frustrado|nao funciona|horrivel)\b/g) || []).length;

  if (positive > 0 && negative > 0) return { polarity: "mixed" };
  if (negative > positive) return { polarity: "negative" };
  if (positive > negative) return { polarity: "positive" };
  return { polarity: "neutral" };
}

