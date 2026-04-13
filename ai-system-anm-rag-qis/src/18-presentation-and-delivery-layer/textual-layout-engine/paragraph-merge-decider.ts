import { ensureUtf8Response } from "../text-encoding-guard";
import { evaluateParagraphCohesion } from "./paragraph-cohesion-engine";
import type { ResponseLayoutPlan } from "./response-layout-types";

function collapseWhitespace(text: string): string {
  return `${text || ""}`
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function stripDialogueLabels(text: string): string {
  return `${text || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, "\n")
    .trim();
}

function normalize(text: string): string {
  const utf8 = ensureUtf8Response(`${text || ""}`).text;
  return collapseWhitespace(stripDialogueLabels(utf8));
}

function normalizeForCompare(text: string): string {
  return `${normalize(text) || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sentenceCount(text: string): number {
  return `${text || ""}`
    .split(/(?<=[.!?])\s+/g)
    .map((segment) => segment.trim())
    .filter(Boolean).length;
}

function startsWithStructuralToken(text: string): boolean {
  const normalized = `${text || ""}`.trim();
  return (
    /^#{1,6}\s+/.test(normalized) ||
    /^([-*•]|\d+\.)\s+/.test(normalized) ||
    /^```/.test(normalized)
  );
}

function endsWithHardVisualBoundary(text: string): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;
  return /[:;]\s*$/.test(normalized) && sentenceCount(normalized) <= 1;
}

function lexicalSimilarity(a: string, b: string): number {
  const sa = new Set(normalizeForCompare(a).split(/\s+/).filter(Boolean));
  const sb = new Set(normalizeForCompare(b).split(/\s+/).filter(Boolean));

  if (sa.size === 0 || sb.size === 0) return 0;

  let intersection = 0;
  for (const token of sa) {
    if (sb.has(token)) intersection += 1;
  }

  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : intersection / union;
}

function areNearDuplicates(a: string, b: string): boolean {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return lexicalSimilarity(na, nb) >= 0.94;
}

function resolveTargets(plan: ResponseLayoutPlan) {
  const minSentences = Math.max(1, plan.targetParagraphSentenceRange[0]);
  const maxSentences = Math.max(minSentences, plan.targetParagraphSentenceRange[1]);
  const minChars = Math.max(80, plan.targetParagraphCharRange[0] || 80);
  const maxChars = Math.max(minChars, plan.targetParagraphCharRange[1] || 220);

  return {
    minSentences,
    maxSentences,
    minChars,
    maxChars,
  };
}

function isUndersizedParagraph(
  text: string,
  targets: ReturnType<typeof resolveTargets>,
): boolean {
  const chars = normalize(text).length;
  const sentences = sentenceCount(text);

  return (
    sentences < targets.minSentences ||
    chars < Math.round(targets.minChars * 0.72)
  );
}

function canMergedSizeFit(
  previous: string,
  current: string,
  targets: ReturnType<typeof resolveTargets>,
  plan: ResponseLayoutPlan,
): boolean {
  const mergedChars = normalize(`${previous} ${current}`).length;
  const mergedSentences = sentenceCount(previous) + sentenceCount(current);

  const charAllowance = plan.keepDenseParagraphs ? 1.35 : 1.22;
  const sentenceAllowance = plan.keepDenseParagraphs ? 2 : 1;

  if (mergedChars > Math.round(targets.maxChars * charAllowance)) return false;
  if (mergedSentences > targets.maxSentences + sentenceAllowance) return false;

  return true;
}

function shouldForceMergeForDensity(
  previous: string,
  current: string,
  targets: ReturnType<typeof resolveTargets>,
): boolean {
  const prevUndersized = isUndersizedParagraph(previous, targets);
  const currentUndersized = isUndersizedParagraph(current, targets);

  if (prevUndersized || currentUndersized) return true;

  const prevChars = normalize(previous).length;
  const currentChars = normalize(current).length;

  if (prevChars < targets.minChars * 0.82 && currentChars < targets.minChars * 0.82) {
    return true;
  }

  return false;
}

function shouldPreserveStandaloneParagraph(
  previous: string,
  current: string,
  targets: ReturnType<typeof resolveTargets>,
): boolean {
  const prevSentences = sentenceCount(previous);
  const nextSentences = sentenceCount(current);
  const prevChars = normalize(previous).length;
  const nextChars = normalize(current).length;

  const bothHealthy =
    prevSentences >= targets.minSentences &&
    nextSentences >= targets.minSentences &&
    prevChars >= targets.minChars * 0.9 &&
    nextChars >= targets.minChars * 0.9;

  if (!bothHealthy) return false;

  const previousClosed = /[.!?)]\s*$/.test(previous);
  const nextLooksNewBlock =
    /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9]/.test(current) ||
    startsWithStructuralToken(current);

  return previousClosed && nextLooksNewBlock;
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
  if (areNearDuplicates(prev, next)) return false;

  const targets = resolveTargets(plan);
  if (!canMergedSizeFit(prev, next, targets, plan)) return false;
  if (shouldPreserveStandaloneParagraph(prev, next, targets)) return false;

  const prevSentences = sentenceCount(prev);
  const nextSentences = sentenceCount(next);
  const prevChars = prev.length;
  const nextChars = next.length;

  const cohesion = evaluateParagraphCohesion(prev, next);

  const strongTopicShift =
    cohesion.topicShiftScore > Math.max(0.58, plan.flushThreshold + 0.05);

  if (strongTopicShift) return false;

  const veryWeakCohesion =
    cohesion.semanticCohesion < 0.2 &&
    cohesion.connectorContinuity === 0 &&
    nextSentences > 1;

  if (veryWeakCohesion) return false;

  const forceMergeForDensity = shouldForceMergeForDensity(prev, next, targets);

  if (forceMergeForDensity) {
    if (cohesion.semanticCohesion >= Math.max(0.24, plan.mergeAggressiveness - 0.24)) {
      return true;
    }

    const lowShift = cohesion.topicShiftScore <= Math.max(0.34, plan.flushThreshold - 0.12);
    if (lowShift) return true;

    return false;
  }

  const bothHealthy =
    prevSentences >= targets.minSentences &&
    nextSentences >= targets.minSentences &&
    prevChars >= targets.minChars * 0.9 &&
    nextChars >= targets.minChars * 0.9;

  if (bothHealthy) {
    const needsStrongReason =
      cohesion.semanticCohesion >= Math.max(0.68, plan.mergeAggressiveness + 0.12) ||
      cohesion.connectorContinuity >= 2;

    if (!needsStrongReason) return false;
  }

  if (endsWithHardVisualBoundary(prev) && cohesion.connectorContinuity === 0) {
    return false;
  }

  if (cohesion.semanticCohesion >= Math.max(plan.mergeAggressiveness, 0.48)) return true;
  if (cohesion.connectorContinuity >= 1 && cohesion.topicShiftScore <= plan.flushThreshold) {
    return true;
  }

  return false;
}

function mergeSinglePass(
  paragraphs: string[],
  plan: ResponseLayoutPlan,
): { paragraphs: string[]; changed: boolean } {
  const clean = (paragraphs || []).map(normalize).filter(Boolean);
  if (clean.length <= 1) return { paragraphs: clean, changed: false };

  const merged: string[] = [];
  let changed = false;

  for (const paragraph of clean) {
    if (!merged.length) {
      merged.push(paragraph);
      continue;
    }

    const previous = merged[merged.length - 1];
    if (shouldMergeParagraphPair(previous, paragraph, plan)) {
      merged[merged.length - 1] = normalize(`${previous} ${paragraph}`);
      changed = true;
      continue;
    }

    merged.push(paragraph);
  }

  return { paragraphs: merged, changed };
}

function mergeTrailingResidualParagraph(
  paragraphs: string[],
  plan: ResponseLayoutPlan,
): string[] {
  if (paragraphs.length < 2) return paragraphs;

  const targets = resolveTargets(plan);
  const last = normalize(paragraphs[paragraphs.length - 1]);
  const previous = normalize(paragraphs[paragraphs.length - 2]);

  if (!isUndersizedParagraph(last, targets)) return paragraphs;
  if (!canMergedSizeFit(previous, last, targets, plan)) return paragraphs;
  if (areNearDuplicates(previous, last)) {
    return paragraphs.slice(0, -1);
  }

  const cohesion = evaluateParagraphCohesion(previous, last);
  const lowShift = cohesion.topicShiftScore <= Math.max(0.36, plan.flushThreshold);
  const enoughCohesion =
    cohesion.semanticCohesion >= Math.max(0.22, plan.mergeAggressiveness - 0.26);

  if (!lowShift && !enoughCohesion) return paragraphs;

  return [
    ...paragraphs.slice(0, -2),
    normalize(`${previous} ${last}`),
  ];
}

function dedupeParagraphs(paragraphs: string[]): string[] {
  const result: string[] = [];

  for (const paragraph of paragraphs) {
    const normalized = normalize(paragraph);
    if (!normalized) continue;

    const previous = result.length > 0 ? result[result.length - 1] : "";
    if (previous && areNearDuplicates(previous, normalized)) {
      continue;
    }

    result.push(normalized);
  }

  return result;
}

export function mergeParagraphsByPlan(
  paragraphs: string[],
  plan: ResponseLayoutPlan,
): string[] {
  let current = dedupeParagraphs((paragraphs || []).map(normalize).filter(Boolean));
  if (current.length <= 1) return current;

  let iterations = 0;
  while (iterations < 3) {
    const result = mergeSinglePass(current, plan);
    current = dedupeParagraphs(result.paragraphs);
    iterations += 1;

    if (!result.changed) break;
  }

  current = mergeTrailingResidualParagraph(current, plan);
  current = dedupeParagraphs(current);

  return current;
}