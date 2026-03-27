import { normalizeText } from "../presentation-contracts";
import type { ChatBubbleView } from "../presentation-contracts";

export interface ChatBubbleAdapterInput {
  text: string;
  role?: "assistant";
  maxParagraphs?: number;
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

export function chatBubbleAdapter(input: ChatBubbleAdapterInput): ChatBubbleAdapterOutput {
  const text = normalizeText(input.text);
  const maxParagraphs = Number.isFinite(input.maxParagraphs)
    ? Math.max(1, Math.trunc(input.maxParagraphs as number))
    : 24;
  const paragraphs = splitParagraphs(text).slice(0, maxParagraphs);
  const fallbackParagraphs = paragraphs.length ? paragraphs : (text ? [text] : []);
  const bubble: ChatBubbleView = {
    role: input.role || "assistant",
    text,
    paragraphs: fallbackParagraphs,
    paragraphCount: fallbackParagraphs.length,
    charCount: text.length,
  };

  const paragraphDensity =
    bubble.paragraphCount > 0 ? Math.min(1, bubble.charCount / (bubble.paragraphCount * 180)) : 0;
  const score = Math.max(0.5, Math.min(0.98, 0.66 + paragraphDensity * 0.24));

  return {
    ok: true,
    component: "chat-bubble-adapter",
    score,
    bubble,
  };
}
