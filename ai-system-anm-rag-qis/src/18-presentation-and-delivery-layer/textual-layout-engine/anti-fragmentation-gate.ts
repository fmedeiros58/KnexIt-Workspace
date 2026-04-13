import { ensureUtf8Response } from "../text-encoding-guard";
import { mergeParagraphsByPlan } from "./paragraph-merge-decider";
import type { ResponseLayoutPlan } from "./response-layout-types";

export type AntiFragmentationGateResult = {
  triggered: boolean;
  issues: string[];
  repairedText: string;
};

function collapseWhitespace(text: string): string {
  return `${text || ""}`
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
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

function splitParagraphs(text: string): string[] {
  return normalize(text)
    .split(/\n{2,}/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function sentenceCount(text: string): number {
  const segments = `${text || ""}`
    .split(/(?<=[.!?])\s+/g)
    .map((segment) => segment.trim())
    .filter(Boolean);

  return segments.length || (`${text || ""}`.trim() ? 1 : 0);
}

function charCount(text: string): number {
  return normalize(text).length;
}

function startsWithStructuralToken(text: string): boolean {
  const normalized = `${text || ""}`.trim();
  return (
    /^#{1,6}\s+/.test(normalized) ||
    /^([-*•]|\d+\.)\s+/.test(normalized) ||
    /^```/.test(normalized)
  );
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

function isShortParagraph(
  paragraph: string,
  targets: ReturnType<typeof resolveTargets>,
): boolean {
  const sentences = sentenceCount(paragraph);
  const chars = charCount(paragraph);

  return (
    sentences <= 1 ||
    sentences < targets.minSentences ||
    chars < Math.round(targets.minChars * 0.72)
  );
}

function fragmentationMetrics(
  paragraphs: string[],
  targets: ReturnType<typeof resolveTargets>,
) {
  const eligible = paragraphs.filter((paragraph) => !startsWithStructuralToken(paragraph));
  const shortParagraphs = eligible.filter((paragraph) =>
    isShortParagraph(paragraph, targets),
  );

  const avgSentences =
    eligible.reduce((sum, paragraph) => sum + sentenceCount(paragraph), 0) /
    Math.max(1, eligible.length);

  const avgChars =
    eligible.reduce((sum, paragraph) => sum + charCount(paragraph), 0) /
    Math.max(1, eligible.length);

  return {
    eligibleCount: eligible.length,
    shortCount: shortParagraphs.length,
    shortRatio: shortParagraphs.length / Math.max(1, eligible.length),
    avgSentences,
    avgChars,
  };
}

function fallbackMergeParagraphs(
  paragraphs: string[],
  plan: ResponseLayoutPlan,
): string[] {
  const targets = resolveTargets(plan);
  const result: string[] = [];
  let buffer: string[] = [];

  for (const paragraph of paragraphs) {
    const normalized = normalize(paragraph);
    if (!normalized) continue;

    if (startsWithStructuralToken(normalized)) {
      if (buffer.length) {
        result.push(normalize(buffer.join(" ")));
        buffer = [];
      }
      result.push(normalized);
      continue;
    }

    const previousBuffered = buffer.length ? buffer[buffer.length - 1] : "";
    if (previousBuffered && areNearDuplicates(previousBuffered, normalized)) {
      continue;
    }

    buffer.push(normalized);

    const currentText = normalize(buffer.join(" "));
    const currentSentences = sentenceCount(currentText);
    const currentChars = charCount(currentText);

    const reachedMinimumDensity =
      currentSentences >= targets.minSentences &&
      currentChars >= targets.minChars;

    const reachedHealthyDensity =
      currentSentences >= Math.max(targets.minSentences, targets.maxSentences - 1) ||
      currentChars >= Math.round(targets.maxChars * 0.8);

    if (reachedMinimumDensity && reachedHealthyDensity) {
      result.push(currentText);
      buffer = [];
    }
  }

  if (buffer.length) {
    const pending = normalize(buffer.join(" "));
    if (!pending) return result;

    if (result.length === 0) {
      result.push(pending);
    } else {
      const previous = result[result.length - 1];
      if (areNearDuplicates(previous, pending)) {
        return result;
      }

      const merged = normalize(`${previous} ${pending}`);
      const mergedSentences = sentenceCount(merged);
      const mergedChars = charCount(merged);

      const canMergeSafely =
        mergedSentences <= targets.maxSentences + 1 &&
        mergedChars <= Math.round(targets.maxChars * 1.25);

      if (canMergeSafely && !startsWithStructuralToken(previous)) {
        result[result.length - 1] = merged;
      } else {
        result.push(pending);
      }
    }
  }

  return result.filter(Boolean);
}

function improvedEnough(
  before: string[],
  after: string[],
  plan: ResponseLayoutPlan,
): boolean {
  const targets = resolveTargets(plan);
  const beforeMetrics = fragmentationMetrics(before, targets);
  const afterMetrics = fragmentationMetrics(after, targets);

  if (after.length > before.length) return false;
  if (afterMetrics.shortRatio > beforeMetrics.shortRatio) return false;

  const sentenceImprovement =
    afterMetrics.avgSentences > beforeMetrics.avgSentences + 0.25;
  const charImprovement = afterMetrics.avgChars > beforeMetrics.avgChars + 24;
  const ratioImprovement =
    afterMetrics.shortRatio <= Math.max(0, beforeMetrics.shortRatio - 0.12);

  const meaningfulReduction =
    after.length < before.length &&
    afterMetrics.shortCount < beforeMetrics.shortCount;

  return sentenceImprovement || charImprovement || ratioImprovement || meaningfulReduction;
}

function dedupeParagraphs(paragraphs: string[]): string[] {
  const result: string[] = [];

  for (const paragraph of paragraphs) {
    const normalized = normalize(paragraph);
    if (!normalized) continue;

    const previous = result[result.length - 1];
    if (previous && areNearDuplicates(previous, normalized)) {
      continue;
    }

    result.push(normalized);
  }

  return result;
}

export function runAntiFragmentationGate(
  text: string,
  plan: ResponseLayoutPlan,
): AntiFragmentationGateResult {
  const source = normalize(text);
  const paragraphs = dedupeParagraphs(splitParagraphs(source));

  if (paragraphs.length <= 1 || plan.allowSingleSentenceParagraphs) {
    return {
      triggered: false,
      issues: [],
      repairedText: source,
    };
  }

  const targets = resolveTargets(plan);
  const metrics = fragmentationMetrics(paragraphs, targets);

  const fragmentedEnough =
    metrics.eligibleCount >= 3 &&
    (
      metrics.shortRatio >= 0.4 ||
      (plan.keepDenseParagraphs && metrics.shortRatio >= 0.3) ||
      (plan.keepDenseParagraphs && metrics.avgSentences < Math.max(2.4, targets.minSentences - 0.4))
    );

  if (!fragmentedEnough) {
    return {
      triggered: false,
      issues: [],
      repairedText: source,
    };
  }

  let mergedParagraphs = dedupeParagraphs(mergeParagraphsByPlan(paragraphs, plan));

  if (!improvedEnough(paragraphs, mergedParagraphs, plan)) {
    mergedParagraphs = dedupeParagraphs(fallbackMergeParagraphs(paragraphs, plan));
  }

  const repaired = normalize(mergedParagraphs.join("\n\n"));

  if (!repaired || repaired === source) {
    return {
      triggered: false,
      issues: [],
      repairedText: source,
    };
  }

  const repairedParagraphs = dedupeParagraphs(splitParagraphs(repaired));
  if (!improvedEnough(paragraphs, repairedParagraphs, plan)) {
    return {
      triggered: false,
      issues: [],
      repairedText: source,
    };
  }

  return {
    triggered: true,
    issues: ["anti_fragmentation_gate_merged_short_paragraphs"],
    repairedText: repaired,
  };
}