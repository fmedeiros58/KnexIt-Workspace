export function hasContinuationMarker(text: string): boolean {
  return /\b(entao|mas ai|mas nesse caso|e nesse caso|seria aqui|isso entra|entra antes|entra depois|no outro arquivo|nesse arquivo)\b/i.test(
    text,
  );
}

export function hasValidationMarker(text: string): boolean {
  return /\b(esta certo|ta certo|isso esta certo|faz sentido|seria isso|e isso|certo assim|correto assim)\b/i.test(
    text,
  );
}

export function hasComparisonMarker(text: string): boolean {
  return /\b(melhor|pior|mais adequado|mais certo|qual fica melhor|qual e melhor|qual fica)\b/i.test(text);
}

export function hasCorrectionMarker(text: string): boolean {
  return /\b(na verdade|mas|so que|porem|acho que nao|isso nao|nao seria|corrige|corrigir)\b/i.test(text);
}

export function hasActionRequestMarker(text: string): boolean {
  return /\b(me ajuda|ajuda nisso|faca|faz|ajuste|corrija|implemente|adiciono|adiciona|coloco|coloca|onde eu coloco|onde eu adiciono)\b/i.test(
    text,
  );
}
