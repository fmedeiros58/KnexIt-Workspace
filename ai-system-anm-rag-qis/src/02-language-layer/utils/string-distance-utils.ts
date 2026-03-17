/**
 * Responsabilidade do arquivo:
 * - Implementar metricas textuais simples para reparo ortografico e deteccao de repeticao.
 * - Evitar dependencia externa para distancia de edicao no 02-language-layer.
 * - Expor funcoes deterministicas que podem ser auditadas por entrada/saida.
 */
export function levenshteinDistance(source: string, target: string): number {
  const a = `${source || ""}`;
  const b = `${target || ""}`;
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, (_, row) =>
    Array.from({ length: b.length + 1 }, (_, column) => (row === 0 ? column : column === 0 ? row : 0)),
  );

  for (let row = 1; row <= a.length; row += 1) {
    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

export function similarityScore(source: string, target: string): number {
  const a = `${source || ""}`;
  const b = `${target || ""}`;
  const maxLength = Math.max(a.length, b.length, 1);
  const distance = levenshteinDistance(a, b);
  return Math.max(0, Math.min(1, 1 - distance / maxLength));
}

export function jaccardSimilarity(leftTokens: string[], rightTokens: string[]): number {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  const union = new Set([...left, ...right]);
  if (!union.size) return 1;
  const intersection = [...left].filter((token) => right.has(token)).length;
  return Math.max(0, Math.min(1, intersection / union.size));
}


