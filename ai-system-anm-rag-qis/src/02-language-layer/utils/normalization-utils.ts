/**
 * Responsabilidade do arquivo:
 * - Reunir utilitarios compartilhados de limpeza textual e limites numericos.
 * - Garantir consistencia de normalizacao entre todos os subnucleos da camada.
 * - Facilitar auditabilidade ao padronizar regras pequenas e reaproveitaveis.
 */
export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function compactWhitespace(text: string): string {
  return `${text || ""}`.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}

export function dedupeList(values: ReadonlyArray<string>): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function normalizePunctuationSpacing(text: string): string {
  return `${text || ""}`
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,.;:!?])([^\s])/g, "$1 $2");
}

export function safeLower(text: string): string {
  return `${text || ""}`.toLowerCase();
}


