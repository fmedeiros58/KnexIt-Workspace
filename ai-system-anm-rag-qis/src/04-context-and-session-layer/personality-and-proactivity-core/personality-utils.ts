export interface TextAnalysis {
  text: string;
  normalized: string;
  tokens: string[];
  tokenCount: number;
  uniqueRatio: number;
  questionCount: number;
  punctuationCount: number;
}

export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function analyzeText(rawText?: string): TextAnalysis {
  const text = (rawText || "").trim();
  const normalized = text.toLowerCase();
  const tokens = normalized.split(/[^a-z0-9áàâãéêíóôõúçñü]+/i).filter(Boolean);
  const tokenCount = tokens.length;
  const uniqueRatio = tokenCount ? (new Set(tokens).size / tokenCount) : 0;
  const questionCount = (text.match(/\?/g) || []).length;
  const punctuationCount = (text.match(/[,:;!?]/g) || []).length;

  return {
    text,
    normalized,
    tokens,
    tokenCount,
    uniqueRatio,
    questionCount,
    punctuationCount,
  };
}

export function countMatches(text: string, pattern: RegExp) {
  return (text.match(pattern) || []).length;
}

export function scoreByDensity(hits: number, tokenCount: number, scale: number) {
  if (!tokenCount || hits <= 0) return 0;
  return clamp01((hits / tokenCount) * scale);
}
