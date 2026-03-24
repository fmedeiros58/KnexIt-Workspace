export interface SentenceBufferingInput {
  tokens: string[];
  maxTokensPerSentence?: number;
}

export interface SentenceBufferingOutput {
  ok: boolean;
  component: string;
  score: number;
  sentences: string[];
}

export function sentenceBuffering(input: SentenceBufferingInput): SentenceBufferingOutput {
  const maxTokensPerSentence = Number.isFinite(input.maxTokensPerSentence)
    ? Math.max(8, Math.trunc(input.maxTokensPerSentence as number))
    : 48;

  const sentences: string[] = [];
  const buffer: string[] = [];

  for (const token of input.tokens || []) {
    buffer.push(token);
    const joined = buffer.join("");
    const sentenceDone = /[.!?]\s*$/.test(joined) || buffer.length >= maxTokensPerSentence;
    if (!sentenceDone) continue;
    sentences.push(joined.trim());
    buffer.length = 0;
  }

  if (buffer.length > 0) {
    sentences.push(buffer.join("").trim());
  }

  return {
    ok: true,
    component: "sentence-buffering",
    score: sentences.length > 0 ? 0.87 : 0.38,
    sentences,
  };
}
