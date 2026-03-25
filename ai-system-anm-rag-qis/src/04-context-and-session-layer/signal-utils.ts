export interface SignalTextAnalysis {
  text: string;
  normalized: string;
  tokens: string[];
  tokenCount: number;
  uniqueRatio: number;
  questionCount: number;
  punctuationCount: number;
}

const STOPWORDS = new Set([
  "a",
  "as",
  "ao",
  "aos",
  "de",
  "da",
  "das",
  "do",
  "dos",
  "e",
  "em",
  "o",
  "os",
  "um",
  "uma",
  "que",
  "com",
  "para",
  "por",
  "no",
  "na",
  "nos",
  "nas",
  "the",
  "and",
  "to",
  "of",
  "for",
  "in",
  "on",
  "with",
  "is",
  "it",
  "this",
  "that",
  "you",
  "we",
  "i",
]);

export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function analyzeSignalText(rawText?: string): SignalTextAnalysis {
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

export function countSignalMatches(text: string, pattern: RegExp) {
  return (text.match(pattern) || []).length;
}

export function pickTopKeywords(tokens: string[], limit = 3) {
  const counts: Record<string, number> = {};
  for (const token of tokens) {
    if (token.length < 3 || STOPWORDS.has(token)) continue;
    counts[token] = (counts[token] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token);
}
