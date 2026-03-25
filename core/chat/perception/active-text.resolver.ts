import type { ConversationChatHistoryItem } from "./types";

const TEXT_CONTINUATION_PATTERNS = [
  /\b(esse|essa|isso|isto)\s+texto\b/i,
  /\b(texto\s+acima|texto\s+anterior)\b/i,
  /\b(continue|continuar|refine|refinar|melhore|melhorar|reescreva|reescrever|corrija|corrigir)\b/i,
  /\b(com\s+base\s+no\s+texto|com\s+base\s+nisso)\b/i,
];

function normalizeExcerpt(text: string, maxChars = 280) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  if (compact.length <= maxChars) return compact;
  return `${compact.slice(0, Math.max(40, maxChars - 3)).trimEnd()}...`;
}

function isTextBlockCandidate(text: string) {
  const compact = text.trim();
  if (!compact) return false;
  if (compact.includes("```")) return true;
  const lineBreaks = (compact.match(/\n/g) || []).length;
  if (lineBreaks >= 2) return true;
  if (compact.length >= 280) return true;
  const quoted = compact.startsWith('"') || compact.startsWith("'");
  return quoted && compact.length >= 120;
}

function extractLatestTextBlock(history: ConversationChatHistoryItem[]) {
  const reversed = [...history].reverse();
  for (const item of reversed) {
    if (item.role !== "user") continue;
    if (!isTextBlockCandidate(item.content)) continue;
    return normalizeExcerpt(item.content);
  }
  return "";
}

export function resolveActiveTextReference(input: {
  prompt: string;
  history: ConversationChatHistoryItem[];
  previousActiveTextReference: string;
  continuityMode: "continue" | "adjust" | "replace";
}) {
  const { prompt, history, previousActiveTextReference, continuityMode } = input;
  const normalizedPrompt = prompt.trim();
  if (isTextBlockCandidate(normalizedPrompt)) {
    return normalizeExcerpt(normalizedPrompt);
  }

  if (
    previousActiveTextReference &&
    continuityMode !== "replace" &&
    TEXT_CONTINUATION_PATTERNS.some((pattern) => pattern.test(normalizedPrompt))
  ) {
    return previousActiveTextReference;
  }

  const latestHistoryText = extractLatestTextBlock(history);
  if (latestHistoryText && continuityMode !== "replace") return latestHistoryText;
  if (latestHistoryText && !previousActiveTextReference) return latestHistoryText;

  if (continuityMode !== "replace") return previousActiveTextReference;
  return "";
}

