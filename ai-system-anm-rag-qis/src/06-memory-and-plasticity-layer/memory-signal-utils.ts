export interface MemoryTextAnalysis {
  text: string;
  normalized: string;
  tokens: string[];
  tokenCount: number;
  uniqueRatio: number;
  punctuationCount: number;
}

export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function analyzeMemoryText(rawText?: string): MemoryTextAnalysis {
  const text = (rawText || "").trim();
  const normalized = text.toLowerCase();
  const tokens = normalized.split(/[^a-z0-9áàâãéêíóôõúçñü]+/i).filter(Boolean);
  const tokenCount = tokens.length;
  const uniqueRatio = tokenCount ? (new Set(tokens).size / tokenCount) : 0;
  const punctuationCount = (text.match(/[,:;!?]/g) || []).length;

  return {
    text,
    normalized,
    tokens,
    tokenCount,
    uniqueRatio,
    punctuationCount,
  };
}

export function countMemoryMatches(text: string, pattern: RegExp) {
  return (text.match(pattern) || []).length;
}

export function repeatedTokenRatio(tokens: string[]) {
  if (!tokens.length) return 0;
  const counts: Record<string, number> = {};
  for (const token of tokens) counts[token] = (counts[token] || 0) + 1;
  const repeated = Object.values(counts).filter((count) => count > 1).reduce((sum, count) => sum + count, 0);
  return repeated / tokens.length;
}
