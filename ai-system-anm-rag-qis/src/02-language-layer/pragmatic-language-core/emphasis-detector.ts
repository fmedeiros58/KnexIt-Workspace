/**
 * Responsabilidade do arquivo:
 * - Detectar enfase argumentativa por intensificadores, repeticao e grafia enfatica.
 * - Medir intensidade de enfase sem inferir emocao completa.
 * - Expor marcadores usados no calculo para auditoria.
 */
import { clamp01 } from "../utils/normalization-utils";
import { pragmaticNormalizer } from "./pragmatic-normalizer";
import { EMPHASIS_FAMILIES } from "./pragmatic-pattern-library";

export interface EmphasisDetectorInput {
  text: string;
}

export interface EmphasisDetectorResult {
  strength: number;
  markers: string[];
}

export function emphasisDetector(input: EmphasisDetectorInput): EmphasisDetectorResult {
  const normalized = pragmaticNormalizer({ text: input.text });
  const text = normalized.compactText;
  const markers: string[] = [];

  const capsTokens = (normalized.originalText.match(/\b[A-Z]{3,}\b/g) || []).length;
  const repeatedPunctuation = (normalized.originalText.match(/[!?]{2,}/g) || []).length;

  const intensifierFamilies = EMPHASIS_FAMILIES.flatMap((family) =>
    family.patterns
      .filter((pattern) => pattern.test(text))
      .map(() => family.name),
  );

  if (capsTokens > 0) markers.push("caps");
  if (repeatedPunctuation > 0) markers.push("repeated_punctuation");
  if (intensifierFamilies.length > 0) markers.push(...intensifierFamilies);

  return {
    strength: clamp01(
      0.08 +
      capsTokens * 0.18 +
      repeatedPunctuation * 0.15 +
      intensifierFamilies.length * 0.12,
    ),
    markers: [...new Set(markers)],
  };
}
