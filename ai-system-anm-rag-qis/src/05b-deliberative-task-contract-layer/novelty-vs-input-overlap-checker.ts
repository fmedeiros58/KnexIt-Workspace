export interface NoveltyOverlapResult {
  overlapRatio: number;
  noveltyRatio: number;
  promptTokenCount: number;
  responseTokenCount: number;
  sharedTokenCount: number;
  isLowNovelty: boolean;
  isHighOverlap: boolean;
}

const STOPWORDS = new Set([
  "a",
  "as",
  "o",
  "os",
  "um",
  "uma",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "ou",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "para",
  "por",
  "com",
  "sem",
  "que",
  "se",
  "ao",
  "aos",
  "the",
  "and",
  "or",
  "to",
  "for",
  "of",
  "in",
  "on",
  "at",
  "with",
  "without",
  "this",
  "that",
  "is",
  "are",
  "be",
  "as",
  "it",
  "an",
]);

function normalize(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTokenSet(text: string): Set<string> {
  const tokens = normalize(text)
    .split(" ")
    .map((item) => item.trim())
    .filter((item) => item.length >= 3 && !STOPWORDS.has(item));
  return new Set(tokens);
}

export function checkNoveltyVsInputOverlap(userPrompt: string, responseText: string): NoveltyOverlapResult {
  const promptTokens = toTokenSet(userPrompt);
  const responseTokens = toTokenSet(responseText);
  const promptTokenCount = promptTokens.size;
  const responseTokenCount = responseTokens.size;

  if (!promptTokenCount || !responseTokenCount) {
    return {
      overlapRatio: 0,
      noveltyRatio: responseTokenCount > 0 ? 1 : 0,
      promptTokenCount,
      responseTokenCount,
      sharedTokenCount: 0,
      isLowNovelty: false,
      isHighOverlap: false,
    };
  }

  let shared = 0;
  for (const token of responseTokens) {
    if (promptTokens.has(token)) shared += 1;
  }

  const overlapRatio = Math.max(
    0,
    Math.min(1, shared / Math.max(1, Math.min(promptTokenCount, responseTokenCount))),
  );
  const noveltyRatio = Math.max(0, Math.min(1, (responseTokenCount - shared) / Math.max(1, responseTokenCount)));

  return {
    overlapRatio: Number(overlapRatio.toFixed(4)),
    noveltyRatio: Number(noveltyRatio.toFixed(4)),
    promptTokenCount,
    responseTokenCount,
    sharedTokenCount: shared,
    isLowNovelty: noveltyRatio < 0.34,
    isHighOverlap: overlapRatio > 0.78,
  };
}
