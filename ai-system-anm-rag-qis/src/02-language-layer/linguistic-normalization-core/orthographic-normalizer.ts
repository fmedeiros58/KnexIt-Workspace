/**
 * Responsabilidade do arquivo:
 * - Corrigir variacoes ortograficas leves e repeticoes exageradas de caracteres.
 * - Preservar significado original com normalizacao conservadora.
 * - Registrar se houve alteracao ortografica relevante.
 */
export interface OrthographicNormalizerInput {
  text: string;
}

export interface OrthographicNormalizerResult {
  text: string;
  changed: boolean;
}

export function orthographicNormalizer(input: OrthographicNormalizerInput): OrthographicNormalizerResult {
  const before = `${input.text || ""}`;
  const after = before
    .replace(/\b(naumm|naummm)\b/gi, "nao")
    .replace(/\b(obg|obrigad[o|a]{2,})\b/gi, "obrigado")
    .replace(/([a-zA-Z])\1{3,}/g, "$1$1");

  return {
    text: after,
    changed: after !== before,
  };
}

