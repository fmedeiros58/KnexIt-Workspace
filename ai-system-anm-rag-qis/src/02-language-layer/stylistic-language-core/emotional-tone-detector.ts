/**
 * Responsabilidade do arquivo:
 * - Detectar tom emocional predominante em superficie textual.
 * - Entregar classe emocional resumida sem analise psicologica profunda.
 * - Alimentar agregador afetivo com sinal principal de emocao.
 */
import type { EmotionalToneType } from "../types/language-signal-types";

export interface EmotionalToneDetectorInput {
  text: string;
}

export interface EmotionalToneDetectorResult {
  emotionalTone: EmotionalToneType;
}

export function emotionalToneDetector(input: EmotionalToneDetectorInput): EmotionalToneDetectorResult {
  const text = `${input.text || ""}`.toLowerCase();
  if (/\b(frustrado|cansado|irritado|nao aguento|ridiculo)\b/.test(text)) return { emotionalTone: "frustrated" };
  if (/\b(urgente|agora|imediato|pra ontem)\b/.test(text)) return { emotionalTone: "urgent" };
  if (/\b(confuso|nao entendi|perdido|duvida)\b/.test(text)) return { emotionalTone: "confused" };
  if (/\b(otimo|perfeito|excelente|obrigado|valeu)\b/.test(text)) return { emotionalTone: "positive" };
  return { emotionalTone: "calm" };
}

