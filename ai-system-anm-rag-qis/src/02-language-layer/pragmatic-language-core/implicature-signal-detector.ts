/**
 * Responsabilidade do arquivo:
 * - Detectar implicaturas criticas e sinais de revisao implicita.
 * - Ampliar biblioteca de padroes para variacao linguistica.
 */
import { pragmaticNormalizer } from "./pragmatic-normalizer";
import { IMPLICATURE_FAMILIES } from "./pragmatic-pattern-library";

export interface ImplicatureSignalDetectorInput {
  text: string;
}

export interface ImplicatureSignalDetectorResult {
  signals: string[];
}

export function implicatureSignalDetector(
  input: ImplicatureSignalDetectorInput,
): ImplicatureSignalDetectorResult {
  const normalized = pragmaticNormalizer({ text: input.text });
  const text = normalized.compactText;

  const signals = IMPLICATURE_FAMILIES.flatMap((family) =>
    family.patterns
      .filter((pattern) => pattern.test(text))
      .map(() => family.name),
  );

  return {
    signals: [...new Set(signals)],
  };
}
