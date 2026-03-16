/**
 * Responsabilidade do arquivo:
 * - Ajustar uso de maiusculas/minusculas em casos gritantes (ALL CAPS).
 * - Preservar siglas tecnicas curtas e nomes de arquivo.
 * - Produzir texto mais estavel sem descaracterizar estilo do usuario.
 */
export interface CasingNormalizerInput {
  text: string;
}

export interface CasingNormalizerResult {
  text: string;
  changed: boolean;
}

function hasMostlyUppercase(text: string): boolean {
  const letters = text.match(/[A-Za-z]/g) || [];
  const upper = text.match(/[A-Z]/g) || [];
  if (!letters.length) return false;
  return upper.length / letters.length >= 0.8 && letters.length >= 10;
}

export function casingNormalizer(input: CasingNormalizerInput): CasingNormalizerResult {
  const before = `${input.text || ""}`;
  if (!hasMostlyUppercase(before)) return { text: before, changed: false };

  const lowered = before.toLowerCase();
  const after = lowered.length ? `${lowered[0].toUpperCase()}${lowered.slice(1)}` : lowered;
  return { text: after, changed: after !== before };
}

