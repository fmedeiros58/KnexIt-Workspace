/**
 * Responsabilidade do arquivo:
 * - Detectar pedidos indiretos de forma robusta.
 * - Usar familias pragmaticas, nao formas literais rigidas.
 */
import { pragmaticNormalizer } from "./pragmatic-normalizer";
import { INDIRECT_REQUEST_FAMILIES } from "./pragmatic-pattern-library";

export interface IndirectRequestDetectorInput {
  text: string;
}

export interface IndirectRequestDetectorResult {
  detected: boolean;
  cues: string[];
}

export function indirectRequestDetector(
  input: IndirectRequestDetectorInput,
): IndirectRequestDetectorResult {
  const normalized = pragmaticNormalizer({ text: input.text });
  const text = normalized.compactText;

  const cues = INDIRECT_REQUEST_FAMILIES.flatMap((family) =>
    family.patterns
      .filter((pattern) => pattern.test(text))
      .map(() => family.name),
  );

  return {
    detected: cues.length > 0,
    cues: [...new Set(cues)],
  };
}
