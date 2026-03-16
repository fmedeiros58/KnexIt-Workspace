/**
 * Responsabilidade do arquivo:
 * - Centralizar utilitarios de acentos/diacriticos para toda a camada de linguagem.
 * - Fornecer normalizacao estavel para comparacoes lexicais sem alterar semantica.
 * - Expor sinalizadores de qualidade textual para auditoria de ruido de codificacao.
 */
export function removeDiacritics(value: string): string {
  return `${value || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeForComparison(value: string): string {
  return removeDiacritics(value).toLowerCase().trim();
}

export function hasLikelyBrokenEncoding(value: string): boolean {
  return /A??.|A??./.test(`${value || ""}`);
}

const COMMON_PT_REPAIRS: ReadonlyArray<[RegExp, string]> = [
  [/\bnao\b/gi, "nao"],
  [/\bvoce\b/gi, "voce"],
  [/\binformacao\b/gi, "informacao"],
  [/\bconstrucao\b/gi, "construcao"],
];

export function applyConservativeAccentRepair(value: string): string {
  let current = `${value || ""}`;
  for (const [pattern, replacement] of COMMON_PT_REPAIRS) {
    current = current.replace(pattern, replacement);
  }
  return current;
}


