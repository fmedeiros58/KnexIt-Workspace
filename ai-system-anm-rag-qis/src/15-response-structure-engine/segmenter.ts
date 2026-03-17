import { classifySegment } from "./segment-classifier";
import type { TextSegment } from "./types";

function normalizeForComparison(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGreeting(text: string): boolean {
  return /^(oi|ola|hello|hi|hey|e ai|eae|tudo bem\??)$/i.test(normalizeForComparison(text));
}

function pickBestPipePart(text: string): string {
  if (!text.includes("|")) return text;
  const parts = text
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return text;

  let best = parts[0];
  let bestScore = -Infinity;

  for (const part of parts) {
    const normalized = normalizeForComparison(part);
    const tokenCount = normalized ? normalized.split(" ").length : 0;
    const punctuationScore = (part.match(/[.!?]/g) || []).length * 2;
    const greetingPenalty = isGreeting(part) ? 8 : 0;
    const score = (part.length * 0.6) + tokenCount + punctuationScore - greetingPenalty;
    if (score > bestScore) {
      bestScore = score;
      best = part;
    }
  }

  return best;
}

function collapseRepeatedContent(text: string): string {
  const sentenceParts = text
    .split(/(?<=[.!?])\s+/g)
    .map((part) => part.trim())
    .filter(Boolean);

  if (sentenceParts.length > 1) {
    const collapsed: string[] = [];
    let previousNormalized = "";
    for (const sentence of sentenceParts) {
      const normalized = normalizeForComparison(sentence);
      if (normalized && normalized === previousNormalized) continue;
      previousNormalized = normalized;
      collapsed.push(sentence);
    }
    text = collapsed.join(" ").trim();
  }

  const words = text.split(/\s+/g).filter(Boolean);
  if (words.length >= 6 && words.length % 2 === 0) {
    const half = words.length / 2;
    const first = words.slice(0, half).join(" ");
    const second = words.slice(half).join(" ");
    if (normalizeForComparison(first) === normalizeForComparison(second)) {
      text = first;
    }
  }

  return text;
}

function cleanLine(line: string): string {
  let cleaned = line.trim();
  cleaned = cleaned.replace(/^pensou por \d+ms$/i, "");
  cleaned = pickBestPipePart(cleaned);
  cleaned = cleaned
    .replace(/^al[e\u00e9]m disso,\s*/i, "")
    .replace(/^por outro lado,\s*/i, "")
    .replace(/^nesse sentido,\s*/i, "")
    .replace(/^conclus[a\u00e3]o:\s*/i, "")
    .replace(/^[\-*•–—]\s*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  cleaned = collapseRepeatedContent(cleaned)
    .replace(/([!?])\s*\./g, "$1")
    .replace(/[|]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned;
}

export function segmentText(text: string): TextSegment[] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((raw) => {
      const cleaned = cleanLine(raw);
      return {
        raw,
        cleaned,
        normalized: normalizeForComparison(cleaned),
        kind: classifySegment(cleaned),
        score: cleaned.length,
      };
    })
    .filter((segment) => segment.cleaned);
}
