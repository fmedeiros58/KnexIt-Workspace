import type { ResponseLayoutPlan } from "../textual-layout-engine/response-layout-types";
import { streamSafeParagraphAssembler } from "../textual-layout-engine/stream-safe-paragraph-assembler";

export interface ParagraphFlushLogicInput {
  sentences: string[];
  maxSentencesPerParagraph?: number;
  layoutPlan?: ResponseLayoutPlan;
}

export interface ParagraphFlushLogicOutput {
  ok: boolean;
  component: string;
  score: number;
  paragraphs: string[];
}

function fallbackParagraphBuild(sentences: string[], maxSentencesPerParagraph: number) {
  const paragraphs: string[] = [];
  let cursor: string[] = [];
  for (const sentence of sentences || []) {
    const normalized = `${sentence || ""}`.trim();
    if (!normalized) continue;
    cursor.push(normalized);
    if (cursor.length < maxSentencesPerParagraph) continue;
    paragraphs.push(cursor.join(" ").trim());
    cursor = [];
  }
  if (cursor.length) paragraphs.push(cursor.join(" ").trim());
  return paragraphs;
}

export function paragraphFlushLogic(input: ParagraphFlushLogicInput): ParagraphFlushLogicOutput {
  const maxSentencesPerParagraph = Number.isFinite(input.maxSentencesPerParagraph)
    ? Math.max(1, Math.trunc(input.maxSentencesPerParagraph as number))
    : 3;

  let paragraphs: string[] = [];
  if (input.layoutPlan) {
    const assembled = streamSafeParagraphAssembler({
      sentences: input.sentences || [],
      plan: input.layoutPlan,
    });
    paragraphs = assembled.paragraphs;
  }

  if (!paragraphs.length) {
    paragraphs = fallbackParagraphBuild(input.sentences || [], maxSentencesPerParagraph);
  }

  return {
    ok: true,
    component: "paragraph-flush-logic",
    score: paragraphs.length > 0 ? 0.89 : 0.41,
    paragraphs,
  };
}
