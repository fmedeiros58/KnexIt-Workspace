/**
 * Responsabilidade do arquivo:
 * - Entregar tokenizacao leve para palavras/sentencas sem dependencia externa.
 * - Padronizar recortes textuais usados por detectores linguisticos.
 * - Facilitar auditoria ao manter regras de segmentacao em um unico ponto.
 */
const WORD_SPLIT = /[^\p{L}\p{N}_./-]+/gu;

export function tokenizeWords(text: string): string[] {
  return `${text || ""}`
    .trim()
    .split(WORD_SPLIT)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function splitSentences(text: string): string[] {
  return `${text || ""}`
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function generateTokenWindows(tokens: string[], windowSize: number): string[][] {
  if (windowSize <= 0 || tokens.length === 0) return [];
  const windows: string[][] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    windows.push(tokens.slice(index, index + windowSize));
  }
  return windows;
}

export function countRepeatedTokens(tokens: string[]): number {
  if (tokens.length <= 1) return 0;
  let repeated = 0;
  for (let index = 1; index < tokens.length; index += 1) {
    if (tokens[index] === tokens[index - 1]) repeated += 1;
  }
  return repeated;
}


