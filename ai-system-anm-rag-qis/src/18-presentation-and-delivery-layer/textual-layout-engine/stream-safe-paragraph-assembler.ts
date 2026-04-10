import { ensureUtf8Response } from "../text-encoding-guard";
import { buildParagraphCandidatesFromSentences } from "./paragraph-cohesion-engine";
import { mergeParagraphsByPlan } from "./paragraph-merge-decider";
import type {
  ParagraphAssemblerInput,
  ParagraphAssemblerOutput,
} from "./response-layout-types";

function collapseWhitespace(text: string): string {
  return `${text || ""}`
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function stripDialogueLabels(text: string): string {
  return `${text || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, "\n")
    .trim();
}

function sanitizeText(text: string): string {
  const utf8 = ensureUtf8Response(`${text || ""}`).text;
  return collapseWhitespace(stripDialogueLabels(utf8));
}

function normalize(text: string): string {
  return sanitizeText(text);
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

function flattenCandidatesToParagraphs(
  candidates: ParagraphAssemblerOutput["candidates"],
): string[] {
  return candidates
    .map((candidate) => normalize(candidate.sentences.join(" ")))
    .filter(Boolean);
}

function splitIntoSentences(text: string): string[] {
  return `${text || ""}`
    .split(/(?<=[.!?])\s+/g)
    .map((item) => normalize(item))
    .filter(Boolean);
}

function countSentences(text: string): number {
  return splitIntoSentences(text).length;
}

function getSentenceTargets(input: ParagraphAssemblerInput): {
  min: number;
  target: number;
  max: number;
} {
  const range = input.plan?.targetParagraphSentenceRange;
  const complexity = `${input.plan?.complexity || ""}`.trim().toLowerCase();

  const min =
    Array.isArray(range) && Number.isFinite(range[0])
      ? Math.max(1, Math.trunc(range[0]))
      : complexity === "deep"
        ? 3
        : 2;

  const max =
    Array.isArray(range) && Number.isFinite(range[1])
      ? Math.max(min, Math.trunc(range[1]))
      : Math.max(complexity === "deep" ? 5 : 4, min + 1);

  const target = Math.max(min, Math.min(max, Math.round((min + max) / 2)));

  return { min, target, max };
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

function safeJoinParagraphs(a: string, b: string): string {
  return normalize(`${a} ${b}`);
}

function mergeSmallParagraphs(
  paragraphs: string[],
  targets: { min: number; target: number; max: number },
): string[] {
  if (paragraphs.length <= 1) return paragraphs;

  const result: string[] = [];

  for (const paragraph of paragraphs) {
    const normalized = normalize(paragraph);
    if (!normalized) continue;

    if (result.length === 0) {
      result.push(normalized);
      continue;
    }

    const currentCount = countSentences(normalized);
    const previous = result[result.length - 1];
    const previousCount = countSentences(previous);

    const shouldMergeBecauseCurrentIsTooSmall = currentCount < targets.min;
    const shouldMergeBecausePreviousIsTooSmall = previousCount < targets.min;
    const combinedCount = previousCount + currentCount;

    const canMergeSafely =
      combinedCount <= targets.max + 1 ||
      previousCount < targets.target ||
      currentCount <= 1;

    const tooSimilarToPrevious = areNearDuplicates(previous, normalized);

    if (
      !tooSimilarToPrevious &&
      (shouldMergeBecauseCurrentIsTooSmall || shouldMergeBecausePreviousIsTooSmall) &&
      canMergeSafely
    ) {
      result[result.length - 1] = safeJoinParagraphs(previous, normalized);
      continue;
    }

    result.push(normalized);
  }

  return result;
}

function mergeTrailingResidualParagraph(
  paragraphs: string[],
  targets: { min: number; target: number; max: number },
): string[] {
  if (paragraphs.length < 2) return paragraphs;

  const last = paragraphs[paragraphs.length - 1];
  const previous = paragraphs[paragraphs.length - 2];
  const lastCount = countSentences(last);
  const previousCount = countSentences(previous);

  if (lastCount >= targets.min) return paragraphs;
  if (areNearDuplicates(previous, last)) return paragraphs.slice(0, -1);

  const combinedCount = lastCount + previousCount;
  if (combinedCount <= targets.max + 1 || previousCount < targets.target) {
    return [
      ...paragraphs.slice(0, -2),
      safeJoinParagraphs(previous, last),
    ];
  }

  return paragraphs;
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

function lightlyRebalanceOversizedParagraphs(
  paragraphs: string[],
  targets: { min: number; target: number; max: number },
): string[] {
  const output: string[] = [];

  for (const paragraph of paragraphs) {
    const sentences = splitIntoSentences(paragraph);

    if (sentences.length <= targets.max + 1) {
      output.push(normalize(paragraph));
      continue;
    }

    let cursor: string[] = [];
    for (let index = 0; index < sentences.length; index += 1) {
      cursor.push(sentences[index]);

      const remaining = sentences.length - (index + 1);
      const reachedTarget = cursor.length >= targets.target;
      const reachedMax = cursor.length >= targets.max;
      const remainingTooSmall = remaining > 0 && remaining < targets.min;

      if (reachedMax || (reachedTarget && !remainingTooSmall)) {
        output.push(normalize(cursor.join(" ")));
        cursor = [];
      }
    }

    if (cursor.length) {
      if (output.length > 0) {
        const last = output[output.length - 1];
        if (countSentences(last) + cursor.length <= targets.max + 1) {
          output[output.length - 1] = safeJoinParagraphs(last, cursor.join(" "));
        } else {
          output.push(normalize(cursor.join(" ")));
        }
      } else {
        output.push(normalize(cursor.join(" ")));
      }
    }
  }

  return output.filter(Boolean);
}

function postProcessParagraphs(
  paragraphs: string[],
  input: ParagraphAssemblerInput,
): string[] {
  const targets = getSentenceTargets(input);

  let current = paragraphs.map(normalize).filter(Boolean);
  current = dedupeParagraphs(current);
  current = lightlyRebalanceOversizedParagraphs(current, targets);
  current = mergeSmallParagraphs(current, targets);
  current = mergeTrailingResidualParagraph(current, targets);
  current = dedupeParagraphs(current);

  return current;
}

export function streamSafeParagraphAssembler(
  input: ParagraphAssemblerInput,
): ParagraphAssemblerOutput {
  const sanitizedSentences = (input.sentences || []).map(normalize).filter(Boolean);

  const candidates = buildParagraphCandidatesFromSentences(
    sanitizedSentences,
    input.plan,
  );

  if (!candidates.length) {
    return { paragraphs: [], candidates: [] };
  }

  const baseParagraphs = flattenCandidatesToParagraphs(candidates);
  const mergedParagraphs = mergeParagraphsByPlan(baseParagraphs, input.plan);
  const paragraphs = postProcessParagraphs(mergedParagraphs, {
    ...input,
    sentences: sanitizedSentences,
  });

  return {
    paragraphs,
    candidates,
  };
}