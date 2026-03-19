/**
 * Responsabilidade do arquivo:
 * - Medir nivel de polidez/formalidade com heuristicas lexicais simples.
 * - Produzir score auditavel em [0,1] para o estado pragmatico.
 * - Servir de insumo para rapport sem decidir estrategia conversacional.
 */
import { clamp01 } from "../utils/normalization-utils";
import { pragmaticNormalizer } from "./pragmatic-normalizer";
import {
  LOW_POLITENESS_FAMILIES,
  POLITENESS_FAMILIES,
} from "./pragmatic-pattern-library";

export interface PolitenessDetectorInput {
  text: string;
}

export interface PolitenessDetectorResult {
  politeness: number;
  register: "informal" | "balanced" | "formal";
}

export function politenessDetector(input: PolitenessDetectorInput): PolitenessDetectorResult {
  const normalized = pragmaticNormalizer({ text: input.text });
  const text = normalized.compactText;

  const positiveHits = POLITENESS_FAMILIES.flatMap((family) =>
    family.patterns.filter((pattern) => pattern.test(text)),
  ).length;

  const negative = LOW_POLITENESS_FAMILIES.flatMap((family) =>
    family.patterns.filter((pattern) => pattern.test(text)),
  ).length;
  const formal = /\b(prezado|solicito|atenciosamente|cordialmente)\b/i.test(normalized.normalizedText);

  const politeness = clamp01(0.44 + positiveHits * 0.16 - negative * 0.1 + (formal ? 0.1 : 0));
  const register = formal ? "formal" : politeness < 0.42 ? "informal" : "balanced";

  return { politeness, register };
}
