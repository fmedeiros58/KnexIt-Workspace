/**
 * Responsabilidade do arquivo:
 * - Concentrar reconhecimento de padroes lexicais por regex para detectores linguisticos.
 * - Unificar contagem/coleta de matches para reduzir duplicacao entre modulos.
 * - Entregar operacoes previsiveis que apoiam trilhas de auditoria textual.
 */
export function countPatternMatches(text: string, pattern: RegExp): number {
  const normalizedText = `${text || ""}`;
  const globalPattern = pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
  const matches = normalizedText.match(globalPattern);
  return matches ? matches.length : 0;
}

export function collectPatternMatches(text: string, pattern: RegExp): string[] {
  const normalizedText = `${text || ""}`;
  const globalPattern = pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
  return [...normalizedText.matchAll(globalPattern)].map((match) => match[0]).filter(Boolean);
}

export function hasAnyPattern(text: string, patterns: ReadonlyArray<RegExp>): boolean {
  const normalizedText = `${text || ""}`;
  return patterns.some((pattern) => pattern.test(normalizedText));
}

export function densityByLength(count: number, text: string): number {
  const length = Math.max(1, `${text || ""}`.trim().split(/\s+/g).filter(Boolean).length);
  return Math.max(0, Math.min(1, count / length));
}


