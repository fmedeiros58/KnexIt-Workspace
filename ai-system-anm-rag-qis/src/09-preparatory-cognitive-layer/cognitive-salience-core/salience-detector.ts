export interface SalienceInput {
  text: string;
}

export interface SalienceResult {
  salientTerms: string[];
}

export function salienceDetector(input: SalienceInput): SalienceResult {
  const tokens = `${input.text || ""}`
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/g)
    .filter((token) => token.length >= 4);
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  const salientTerms = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map((entry) => entry[0]);
  return { salientTerms };
}
