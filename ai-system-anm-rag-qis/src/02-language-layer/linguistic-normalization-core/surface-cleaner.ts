/**
 * Responsabilidade do arquivo:
 * - Remover ruido superficial nao semantico (lixo de markup e repeticao de separadores).
 * - Preservar texto util para interpretacao linguistica.
 * - Atuar antes da consolidacao final de normalizacao.
 */
export interface SurfaceCleanerInput {
  text: string;
}

export interface SurfaceCleanerResult {
  text: string;
  changed: boolean;
}

export function surfaceCleaner(input: SurfaceCleanerInput): SurfaceCleanerResult {
  const before = `${input.text || ""}`;
  const after = before
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/[~`]{2,}/g, " ")
    .replace(/[-=_]{3,}/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return {
    text: after,
    changed: after !== before,
  };
}

