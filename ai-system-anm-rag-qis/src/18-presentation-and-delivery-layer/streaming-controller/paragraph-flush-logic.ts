export interface ParagraphFlushLogicInput {
  sentences: string[];
  maxSentencesPerParagraph?: number;
}

export interface ParagraphFlushLogicOutput {
  ok: boolean;
  component: string;
  score: number;
  paragraphs: string[];
}

export function paragraphFlushLogic(input: ParagraphFlushLogicInput): ParagraphFlushLogicOutput {
  const maxSentencesPerParagraph = Number.isFinite(input.maxSentencesPerParagraph)
    ? Math.max(1, Math.trunc(input.maxSentencesPerParagraph as number))
    : 3;

  const paragraphs: string[] = [];
  let cursor: string[] = [];

  for (const sentence of input.sentences || []) {
    if (!sentence) continue;
    cursor.push(sentence.trim());
    if (cursor.length < maxSentencesPerParagraph) continue;
    paragraphs.push(cursor.join(" ").trim());
    cursor = [];
  }

  if (cursor.length > 0) {
    paragraphs.push(cursor.join(" ").trim());
  }

  return {
    ok: true,
    component: "paragraph-flush-logic",
    score: paragraphs.length > 0 ? 0.89 : 0.41,
    paragraphs,
  };
}
