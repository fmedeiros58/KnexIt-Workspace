/**
 * Responsabilidade do arquivo:
 * - Detectar tom estilistico geral (neutral, friendly, direct, formal).
 * - Manter foco em estilo textual, sem classificar emocao profunda sozinho.
 * - Entregar tom base para agregacao afetiva.
 */
import type { ToneType } from "../types/language-signal-types";

export interface ToneDetectionInput {
  text: string;
}

export interface ToneDetection {
  tone: ToneType;
  register: "informal" | "balanced" | "formal";
}

export function toneDetector(input: ToneDetectionInput): ToneDetection {
  const text = `${input.text || ""}`.trim();
  const lowered = text.toLowerCase();
  const hasFriendlySignal = /\b(oi|ola|tudo bem|obrigado|valeu|haha|kkk)\b/.test(lowered) || /[!]{2,}/.test(text);
  const hasFormalSignal = /\b(prezado|cordialmente|atenciosamente|solicito|gostaria)\b/.test(lowered);
  const hasDirectSignal = /\b(agora|direto|objetivo|sem enrolar|imediato)\b/.test(lowered);

  if (hasFormalSignal) return { tone: "formal", register: "formal" };
  if (hasDirectSignal) return { tone: "direct", register: "balanced" };
  if (hasFriendlySignal) return { tone: "friendly", register: "informal" };
  return { tone: "neutral", register: "balanced" };
}

