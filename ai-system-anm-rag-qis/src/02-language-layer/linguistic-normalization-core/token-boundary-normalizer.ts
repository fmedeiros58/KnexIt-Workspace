/**
 * Responsabilidade do arquivo:
 * - Ajustar fronteiras de tokens quando pontuacao cola indevidamente.
 * - Melhorar segmentacao para detectores posteriores sem alterar semantica.
 * - Fornecer texto tokenizavel de forma consistente.
 */
export interface TokenBoundaryNormalizerInput {
  text: string;
}

export interface TokenBoundaryNormalizerResult {
  text: string;
  changed: boolean;
}

export function tokenBoundaryNormalizer(input: TokenBoundaryNormalizerInput): TokenBoundaryNormalizerResult {
  const before = `${input.text || ""}`;
  const after = before
    .replace(/([a-zA-Z0-9])([,.;:!?])/g, "$1 $2")
    .replace(/([,.;:!?])([a-zA-Z0-9])/g, "$1 $2")
    .replace(/\s{2,}/g, " ")
    .trim();

  return {
    text: after,
    changed: after !== before,
  };
}

