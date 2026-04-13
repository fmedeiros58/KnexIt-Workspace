import { normalizeText } from "../presentation-contracts";
import type { ChatBubbleView } from "../presentation-contracts";
import type { ResponseLayoutPlan } from "../textual-layout-engine/response-layout-types";
import { mergeParagraphsByPlan } from "../textual-layout-engine/paragraph-merge-decider";

export interface ChatBubbleAdapterInput {
  text: string;
  role?: "assistant";
  maxParagraphs?: number;
  layoutPlan?: ResponseLayoutPlan;
}

export interface ChatBubbleAdapterOutput {
  ok: boolean;
  component: string;
  score: number;
  bubble: ChatBubbleView;
}

function splitParagraphs(text: string): string[] {
  return normalizeText(text)
    .split(/\n{2,}/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitSentences(text: string): string[] {
  return `${text || ""}`
    .split(/(?<=[.!?])\s+/g)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function chunkSentences(sentences: string[], chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += chunkSize) {
    chunks.push(sentences.slice(i, i + chunkSize).join(" ").trim());
  }
  return chunks.filter(Boolean);
}

export function chatBubbleAdapter(input: ChatBubbleAdapterInput): ChatBubbleAdapterOutput {
  const text = normalizeText(input.text);
  const maxParagraphs = Number.isFinite(input.maxParagraphs)
    ? Math.max(1, Math.trunc(input.maxParagraphs as number))
    : 24;

  let paragraphs = splitParagraphs(text);
  if (input.layoutPlan && paragraphs.length > 1) {
    paragraphs = mergeParagraphsByPlan(paragraphs, input.layoutPlan);
  }
  if (
    input.layoutPlan?.keepDenseParagraphs &&
    paragraphs.length === 1 &&
    paragraphs[0].length >= 980
  ) {
    const sentences = splitSentences(paragraphs[0]);
    if (sentences.length >= input.layoutPlan.targetParagraphSentenceRange[1] + 2) {
      paragraphs = chunkSentences(
        sentences,
        Math.max(3, input.layoutPlan.targetParagraphSentenceRange[0] + 1),
      );
    }
  }
  paragraphs = paragraphs.slice(0, maxParagraphs);
  const fallbackParagraphs = paragraphs.length ? paragraphs : (text ? [text] : []);
  const bubbleText = fallbackParagraphs.join("\n\n").trim();

  const bubble: ChatBubbleView = {
    role: input.role || "assistant",
    text: bubbleText,
    paragraphs: fallbackParagraphs,
    paragraphCount: fallbackParagraphs.length,
    charCount: bubbleText.length,
  };

  const paragraphDensity =
    bubble.paragraphCount > 0 ? Math.min(1, bubble.charCount / (bubble.paragraphCount * 210)) : 0;
  const score = Math.max(0.5, Math.min(0.98, 0.66 + paragraphDensity * 0.24));

  return {
    ok: true,
    component: "chat-bubble-adapter",
    score,
    bubble,
  };
}
