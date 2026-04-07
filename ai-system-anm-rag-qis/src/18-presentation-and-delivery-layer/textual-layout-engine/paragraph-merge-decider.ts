import { evaluateParagraphCohesion } from "./paragraph-cohesion-engine";
import type { ResponseLayoutPlan } from "./response-layout-types";

function sentenceCount(text: string) {
  return `${text || ""}`
    .split(/(?<=[.!?])\s+/g)
    .map((segment) => segment.trim())
    .filter(Boolean).length;
}

function normalize(text: string) {
  return `${text || ""}`
    .replace(/\s+/g, " ")
    .trim();
}

function startsWithStructuralToken(text: string) {
  const normalized = `${text || ""}`.trim();
  return /^#{1,6}\s+/.test(normalized) || /^([-*•]|\d+\.)\s+/.test(normalized) || /^```/.test(normalized);
}

export function shouldMergeParagraphPair(
  previous: string,
  current: string,
  plan: ResponseLayoutPlan,
): boolean {
  const prev = normalize(previous);
  const next = normalize(current);
  if (!prev || !next) return false;
  if (startsWithStructuralToken(prev) || startsWithStructuralToken(next)) return false;

  const prevChars = prev.length;
  const nextChars = next.length;
  const prevSentences = sentenceCount(prev);
  const nextSentences = sentenceCount(next);
  const cohesion = evaluateParagraphCohesion(prev, next);
  const mergedChars = prevChars + 1 + nextChars;

  if (mergedChars > plan.targetParagraphCharRange[1] * 1.25) return false;
  if (cohesion.topicShiftScore > Math.max(0.58, plan.flushThreshold + 0.04)) return false;
  if (cohesion.semanticCohesion < 0.2 && nextSentences > 1) return false;

  const needsMergeForDensity =
    prevSentences < plan.targetParagraphSentenceRange[0] ||
    nextSentences < plan.targetParagraphSentenceRange[0] ||
    prevChars < plan.targetParagraphCharRange[0] * 0.65 ||
    nextChars < plan.targetParagraphCharRange[0] * 0.65;

  if (!needsMergeForDensity) {
    return cohesion.semanticCohesion >= plan.mergeAggressiveness;
  }
  return cohesion.semanticCohesion >= Math.max(0.28, plan.mergeAggressiveness - 0.22);
}

export function mergeParagraphsByPlan(paragraphs: string[], plan: ResponseLayoutPlan): string[] {
  const clean = (paragraphs || []).map((paragraph) => `${paragraph || ""}`.trim()).filter(Boolean);
  if (clean.length <= 1) return clean;

  const merged: string[] = [];
  for (const paragraph of clean) {
    if (!merged.length) {
      merged.push(paragraph);
      continue;
    }
    const previous = merged[merged.length - 1];
    if (shouldMergeParagraphPair(previous, paragraph, plan)) {
      merged[merged.length - 1] = `${previous} ${paragraph}`.replace(/\s+/g, " ").trim();
      continue;
    }
    merged.push(paragraph);
  }
  return merged;
}
