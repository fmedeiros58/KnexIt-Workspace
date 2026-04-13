import { ensureUtf8Response } from "../text-encoding-guard";
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

interface ParagraphTargets {
  min: number;
  target: number;
  max: number;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function collapseWhitespace(value: string): string {
  return `${value || ""}`
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalizeForCompare(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”"'`´]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSentence(value: string): string {
  const utf8 = ensureUtf8Response(`${value || ""}`).text;
  return collapseWhitespace(
    utf8
      .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, "\n")
      .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, "\n"),
  );
}

function normalizeSentences(sentences: string[]): string[] {
  const output: string[] = [];

  for (const sentence of sentences || []) {
    const normalized = normalizeSentence(sentence);
    if (!normalized) continue;

    const last = output[output.length - 1];
    if (last && normalizeForCompare(last) === normalizeForCompare(normalized)) {
      continue;
    }

    output.push(normalized);
  }

  return output;
}

function splitTextIntoSentences(text: string): string[] {
  return `${text || ""}`
    .split(/(?<=[.!?])\s+/g)
    .map(normalizeSentence)
    .filter(Boolean);
}

function countSentences(text: string): number {
  return splitTextIntoSentences(text).length;
}

function resolveParagraphTargets(
  input: ParagraphFlushLogicInput,
): ParagraphTargets {
  const range = input.layoutPlan?.targetParagraphSentenceRange;
  const complexity = `${input.layoutPlan?.complexity || ""}`.trim().toLowerCase();

  const rangeMin = Array.isArray(range) && Number.isFinite(range[0])
    ? Math.max(1, Math.trunc(range[0]))
    : complexity === "deep"
      ? 3
      : 2;

  const rangeMax = Array.isArray(range) && Number.isFinite(range[1])
    ? Math.max(rangeMin, Math.trunc(range[1]))
    : complexity === "deep"
      ? 6
      : 5;

  const explicitMax = Number.isFinite(input.maxSentencesPerParagraph)
    ? Math.max(1, Math.trunc(input.maxSentencesPerParagraph as number))
    : rangeMax;

  const max = Math.max(rangeMin, explicitMax);
  const min = Math.min(rangeMin, max);
  const target = clampInt(Math.round((min + max) / 2), min, max);

  return { min, target, max };
}

function joinSentences(sentences: string[]): string {
  return collapseWhitespace(sentences.map(normalizeSentence).filter(Boolean).join(" "));
}

function joinParagraphs(paragraphs: string[]): string {
  return paragraphs.map((p) => collapseWhitespace(p)).filter(Boolean).join("\n\n");
}

function mergeTrailingShortParagraph(
  paragraphs: string[],
  targets: ParagraphTargets,
): string[] {
  if (paragraphs.length < 2) return paragraphs;

  const last = paragraphs[paragraphs.length - 1];
  const previous = paragraphs[paragraphs.length - 2];
  const lastCount = countSentences(last);
  const prevCount = countSentences(previous);

  if (lastCount >= targets.min) return paragraphs;

  const mergedCount = prevCount + lastCount;
  const canMergeSafely = mergedCount <= targets.max + 2;

  if (canMergeSafely || prevCount < targets.target) {
    const merged = joinSentences([previous, last]);
    return [...paragraphs.slice(0, -2), merged];
  }

  return paragraphs;
}

function splitOversizedParagraphs(
  paragraphs: string[],
  targets: ParagraphTargets,
): string[] {
  const output: string[] = [];

  for (const paragraph of paragraphs) {
    const sentences = splitTextIntoSentences(paragraph);
    if (sentences.length <= targets.max + 2) {
      output.push(joinSentences(sentences));
      continue;
    }

    let cursor: string[] = [];

    for (let index = 0; index < sentences.length; index += 1) {
      cursor.push(sentences[index]);

      const remaining = sentences.length - (index + 1);
      const reachedTarget = cursor.length >= targets.target;
      const reachedMax = cursor.length >= targets.max + 1;
      const remainingTooSmall = remaining > 0 && remaining < targets.min;

      if (reachedMax || (reachedTarget && !remainingTooSmall)) {
        output.push(joinSentences(cursor));
        cursor = [];
      }
    }

    if (cursor.length) {
      if (output.length > 0) {
        const prev = output[output.length - 1];
        const prevCount = countSentences(prev);

        if (cursor.length < targets.min && prevCount + cursor.length <= targets.max + 2) {
          output[output.length - 1] = joinSentences([prev, ...cursor]);
        } else {
          output.push(joinSentences(cursor));
        }
      } else {
        output.push(joinSentences(cursor));
      }
    }
  }

  return output.filter(Boolean);
}

function mergeUndersizedParagraphs(
  paragraphs: string[],
  targets: ParagraphTargets,
): string[] {
  const normalized = paragraphs.map(joinSentencesFromParagraph).filter(Boolean);
  if (normalized.length <= 1) return normalized;

  const merged: string[] = [];
  let pending = "";

  for (const paragraph of normalized) {
    const current = pending ? joinSentences([pending, paragraph]) : paragraph;
    const currentCount = countSentences(current);

    if (currentCount < targets.min) {
      pending = current;
      continue;
    }

    if (pending) {
      merged.push(current);
      pending = "";
      continue;
    }

    merged.push(paragraph);
  }

  if (pending) {
    if (merged.length === 0) {
      merged.push(pending);
    } else {
      const previous = merged[merged.length - 1];
      const previousCount = countSentences(previous);
      const pendingCount = countSentences(pending);

      if (previousCount + pendingCount <= targets.max + 2 || pendingCount < targets.min) {
        merged[merged.length - 1] = joinSentences([previous, pending]);
      } else {
        merged.push(pending);
      }
    }
  }

  return merged.filter(Boolean);
}

function joinSentencesFromParagraph(paragraph: string): string {
  return joinSentences(splitTextIntoSentences(paragraph));
}

function fallbackParagraphBuild(
  sentences: string[],
  targets: ParagraphTargets,
): string[] {
  const normalized = normalizeSentences(sentences);
  if (!normalized.length) return [];

  const paragraphs: string[] = [];
  let cursor: string[] = [];

  for (let index = 0; index < normalized.length; index += 1) {
    cursor.push(normalized[index]);

    const remaining = normalized.length - (index + 1);
    const reachedTarget = cursor.length >= targets.target;
    const reachedMax = cursor.length >= targets.max;
    const remainingTooSmall = remaining > 0 && remaining < targets.min;

    if (reachedMax || (reachedTarget && !remainingTooSmall)) {
      paragraphs.push(joinSentences(cursor));
      cursor = [];
    }
  }

  if (cursor.length) {
    paragraphs.push(joinSentences(cursor));
  }

  return mergeTrailingShortParagraph(paragraphs, targets);
}

function postProcessParagraphs(
  paragraphs: string[],
  targets: ParagraphTargets,
): string[] {
  let current = (paragraphs || []).map(joinSentencesFromParagraph).filter(Boolean);
  if (!current.length) return current;

  current = splitOversizedParagraphs(current, targets);
  current = mergeUndersizedParagraphs(current, targets);
  current = mergeTrailingShortParagraph(current, targets);

  const output: string[] = [];
  for (const paragraph of current) {
    const normalized = normalizeForCompare(paragraph);
    const last = output[output.length - 1];
    if (last && normalizeForCompare(last) === normalized) continue;
    output.push(collapseWhitespace(paragraph));
  }

  return output.filter(Boolean);
}

function estimateScore(
  paragraphs: string[],
  targets: ParagraphTargets,
): number {
  if (!paragraphs.length) return 0.25;

  const counts = paragraphs.map(countSentences);
  const undersized = counts.filter((count) => count < targets.min).length;
  const oversized = counts.filter((count) => count > targets.max + 2).length;

  const withinRange = counts.filter(
    (count) => count >= targets.min && count <= targets.max,
  ).length;

  const withinRangeRatio = withinRange / Math.max(1, counts.length);
  const penalty = (undersized + oversized) / Math.max(1, counts.length);

  const score = 0.58 + withinRangeRatio * 0.36 - penalty * 0.22;
  return Math.max(0.1, Math.min(0.99, Number(score.toFixed(4))));
}

export function paragraphFlushLogic(
  input: ParagraphFlushLogicInput,
): ParagraphFlushLogicOutput {
  const targets = resolveParagraphTargets(input);
  const normalizedSentences = normalizeSentences(input.sentences || []);

  let paragraphs: string[] = [];

  if (input.layoutPlan && normalizedSentences.length > 0) {
    const assembled = streamSafeParagraphAssembler({
      sentences: normalizedSentences,
      plan: input.layoutPlan,
    });
    paragraphs = (assembled.paragraphs || []).map((p) => collapseWhitespace(p)).filter(Boolean);
  }

  if (!paragraphs.length) {
    paragraphs = fallbackParagraphBuild(normalizedSentences, targets);
  }

  paragraphs = postProcessParagraphs(paragraphs, targets);

  if (input.layoutPlan && paragraphs.length > 1) {
    const fragmented = paragraphs.filter(
      (paragraph) => countSentences(paragraph) < targets.min,
    ).length;

    const fragmentationRatio = fragmented / Math.max(1, paragraphs.length);

    if (fragmentationRatio >= 0.4) {
      const rebuiltSentences = paragraphs.flatMap(splitTextIntoSentences);
      const reassembled = streamSafeParagraphAssembler({
        sentences: rebuiltSentences,
        plan: input.layoutPlan,
      });

      const candidate = postProcessParagraphs(reassembled.paragraphs || [], targets);
      if (candidate.length > 0) {
        const currentText = joinParagraphs(paragraphs);
        const candidateText = joinParagraphs(candidate);

        if (candidateText.length >= currentText.length * 0.9) {
          paragraphs = candidate;
        }
      }
    }
  }

  return {
    ok: true,
    component: "paragraph-flush-logic",
    score: estimateScore(paragraphs, targets),
    paragraphs,
  };
}