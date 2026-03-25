/**
 * Responsabilidade do arquivo:
 * - Detectar fragilidade de escopo logico por conectores conflitantes e frases longas.
 * - Retornar score de risco sem resolver logica formal completa.
 * - Ajudar o conversation-layer a decidir necessidade de clarificacao.
 */
import { clamp01 } from "../utils/normalization-utils";

export interface ScopeFragilityDetectorInput {
  text: string;
  ambiguityScore: number;
}

export interface ScopeFragilityDetectorResult {
  fragility: number;
}

export function scopeFragilityDetector(input: ScopeFragilityDetectorInput): ScopeFragilityDetectorResult {
  const text = `${input.text || ""}`.toLowerCase();
  const connectorCount = (text.match(/\b(mas|porem|contudo|entretanto|although|however|unless)\b/g) || []).length;
  const longSentence = text.split(/\s+/g).filter(Boolean).length > 40 ? 0.18 : 0;
  const raw = input.ambiguityScore * 0.58 + connectorCount * 0.09 + longSentence;
  return { fragility: clamp01(raw) };
}

