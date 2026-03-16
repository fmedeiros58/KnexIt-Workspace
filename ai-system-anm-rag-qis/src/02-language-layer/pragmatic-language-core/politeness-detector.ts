/**
 * Responsabilidade do arquivo:
 * - Medir nivel de polidez/formalidade com heuristicas lexicais simples.
 * - Produzir score auditavel em [0,1] para o estado pragmatico.
 * - Servir de insumo para rapport sem decidir estrategia conversacional.
 */
import { clamp01, safeLower } from "../utils/normalization-utils";

export interface PolitenessDetectorInput {
  text: string;
}

export interface PolitenessDetectorResult {
  politeness: number;
  register: "informal" | "balanced" | "formal";
}

export function politenessDetector(input: PolitenessDetectorInput): PolitenessDetectorResult {
  const text = safeLower(input.text);
  const positive = (text.match(/\b(por favor|please|obrigado|agradeco|gentileza|cordialmente)\b/g) || []).length;
  const negative = (text.match(/\b(agora|imediato|sem enrolar|fa(c|s)a isso)\b/g) || []).length;
  const formal = /\b(prezado|solicito|atenciosamente|cordialmente)\b/.test(text);

  const politeness = clamp01(0.44 + positive * 0.16 - negative * 0.1 + (formal ? 0.1 : 0));
  const register = formal ? "formal" : politeness < 0.42 ? "informal" : "balanced";

  return { politeness, register };
}

