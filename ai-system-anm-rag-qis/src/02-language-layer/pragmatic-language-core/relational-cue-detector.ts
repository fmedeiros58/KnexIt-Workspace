/**
 * Responsabilidade do arquivo:
 * - Detectar sinais relacionais e preferencias de tratamento.
 * - Captar nomeacao, limites de estilo e calor social.
 */
import { pragmaticNormalizer } from "./pragmatic-normalizer";
import { RELATIONAL_FAMILIES } from "./pragmatic-pattern-library";

export interface RelationalCueDetectorInput {
  text: string;
}

export interface RelationalCueDetectorResult {
  cues: string[];
}

export function relationalCueDetector(
  input: RelationalCueDetectorInput,
): RelationalCueDetectorResult {
  const normalized = pragmaticNormalizer({ text: input.text });
  const text = normalized.compactText;

  const cues = RELATIONAL_FAMILIES.flatMap((family) =>
    family.patterns
      .filter((pattern) => pattern.test(text))
      .map(() => family.name),
  );

  return {
    cues: [...new Set(cues)].slice(0, 16),
  };
}
