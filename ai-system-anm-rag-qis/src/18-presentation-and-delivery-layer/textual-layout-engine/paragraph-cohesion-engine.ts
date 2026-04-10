import { ensureUtf8Response } from "../text-encoding-guard";
import type {
  ParagraphCandidate,
  ParagraphCohesionSample,
  ResponseLayoutPlan,
} from "./response-layout-types";

const CONTINUITY_CONNECTORS = [
  "alem disso",
  "além disso",
  "nesse sentido",
  "por isso",
  "assim",
  "ou seja",
  "em outras palavras",
  "desse modo",
  "portanto",
  "logo",
  "no entanto",
  "entretanto",
  "por outro lado",
  "however",
  "therefore",
  "in other words",
];

const CONTRAST_CONNECTORS = [
  "por outro lado",
  "no entanto",
  "entretanto",
  "todavia",
  "contudo",
  "however",
  "on the other hand",
];

const ENUMERATION_MARKERS = [
  "primeiro",
  "primeiramente",
  "segundo",
  "terceiro",
  "por fim",
  "finalmente",
];

function collapseWhitespace(value: string): string {
  return `${value || ""}`
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDialogueLabels(value: string): string {
  return `${value || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, "\n")
    .trim();
}

function sanitizeText(value: string): string {
  const utf8 = ensureUtf8Response(`${value || ""}`).text;
  return collapseWhitespace(stripDialogueLabels(utf8));
}

function normalize(value: string): string {
  return sanitizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function sentenceCharLength(sentences: string[]): number {
  return sanitizeText(sentences.join(" ")).length;
}

function sentenceCount(text: string): number {
  const segments = sanitizeText(text)
    .split(/(?<=[.!?])\s+/g)
    .map((segment) => segment.trim())
    .filter(Boolean);

  return segments.length || (sanitizeText(text) ? 1 : 0);
}

function startsWithAny(normalized: string, options: string[]): boolean {
  if (!normalized) return false;
  return options.some((option) => normalized.startsWith(option));
}

function lexicalOverlap(previous: string, current: string): number {
  const prev = new Set(tokenize(previous));
  const curr = new Set(tokenize(current));

  if (!prev.size || !curr.size) return 0;

  let shared = 0;
  for (const token of prev) {
    if (curr.has(token)) shared += 1;
  }

  return shared / Math.max(1, Math.min(prev.size, curr.size));
}

function connectorContinuity(current: string): number {
  const normalized = normalize(current);
  if (!normalized) return 0;
  return startsWithAny(normalized, CONTINUITY_CONNECTORS) ? 1 : 0;
}

function contrastSignal(current: string): number {
  const normalized = normalize(current);
  if (!normalized) return 0;
  return startsWithAny(normalized, CONTRAST_CONNECTORS) ? 1 : 0;
}

function enumerationSignal(current: string): number {
  const normalized = normalize(current);
  if (!normalized) return 0;
  if (startsWithAny(normalized, ENUMERATION_MARKERS)) return 1;
  if (/^(?:\(?[0-9]+[\).\-\:]|[a-z][\).\-\:])\s+/i.test(`${current || ""}`.trim())) return 1;
  return 0;
}

function buildLocalContext(sentences: string[]): string {
  if (!sentences.length) return "";
  return sanitizeText(sentences.slice(-2).join(" "));
}

function dedupeConsecutiveSentences(sentences: string[]): string[] {
  const output: string[] = [];

  for (const sentence of sentences) {
    const cleaned = sanitizeText(sentence);
    if (!cleaned) continue;

    const last = output[output.length - 1];
    if (last && normalize(last) === normalize(cleaned)) {
      continue;
    }

    output.push(cleaned);
  }

  return output;
}

function evaluateParagraphCohesionAgainstContext(
  context: string,
  current: string,
): ParagraphCohesionSample {
  const overlap = lexicalOverlap(context, current);
  const continuity = connectorContinuity(current);
  const contrast = contrastSignal(current);
  const enumeration = enumerationSignal(current);

  const semanticCohesion = Math.max(
    0,
    Math.min(
      1,
      overlap * 0.52 +
        continuity * 0.2 +
        enumeration * 0.12 -
        contrast * 0.1 +
        0.16,
    ),
  );

  const topicShiftScore = Math.max(
    0,
    Math.min(
      1,
      (1 - overlap) * 0.56 +
        contrast * 0.2 -
        continuity * 0.08 -
        enumeration * 0.06,
    ),
  );

  return {
    previous: sanitizeText(context),
    current: sanitizeText(current),
    lexicalOverlap: overlap,
    connectorContinuity: continuity,
    contrastSignal: contrast,
    semanticCohesion,
    topicShiftScore,
  };
}

export function evaluateParagraphCohesion(
  previous: string,
  current: string,
): ParagraphCohesionSample {
  return evaluateParagraphCohesionAgainstContext(previous, current);
}

function resolvePlanTargets(plan: ResponseLayoutPlan) {
  const minSentenceTarget = Math.max(1, plan.targetParagraphSentenceRange[0]);
  const maxSentenceTarget = Math.max(minSentenceTarget, plan.targetParagraphSentenceRange[1]);
  const minChars = Math.max(80, plan.targetParagraphCharRange[0] || 80);
  const maxChars = Math.max(minChars, plan.targetParagraphCharRange[1] || 220);

  return {
    minSentenceTarget,
    maxSentenceTarget,
    minChars,
    maxChars,
  };
}

function shouldDelayFlushForDensity(
  currentSentences: number,
  chars: number,
  semanticCohesion: number,
  topicShift: number,
  plan: ResponseLayoutPlan,
  minSentenceTarget: number,
  minChars: number,
): boolean {
  if (currentSentences < minSentenceTarget) return true;
  if (chars < minChars) return true;
  if (plan.keepDenseParagraphs && semanticCohesion >= 0.66 && topicShift <= 0.42) return true;
  return false;
}

function shouldTreatAsStrongTopicShift(
  topicShift: number,
  semanticCohesion: number,
  currentSentences: number,
  chars: number,
  plan: ResponseLayoutPlan,
  minSentenceTarget: number,
  minChars: number,
): boolean {
  const threshold = Math.max(plan.flushThreshold + 0.08, 0.62);
  const paragraphHealthy =
    currentSentences >= minSentenceTarget &&
    chars >= minChars;

  if (!paragraphHealthy) return false;
  if (semanticCohesion >= 0.46) return false;

  return topicShift >= threshold;
}

export function buildParagraphCandidatesFromSentences(
  sentences: string[],
  plan: ResponseLayoutPlan,
): ParagraphCandidate[] {
  const clean = dedupeConsecutiveSentences(
    (sentences || [])
      .map((sentence) => sanitizeText(sentence))
      .filter(Boolean),
  );

  if (!clean.length) return [];

  const {
    minSentenceTarget,
    maxSentenceTarget,
    minChars,
    maxChars,
  } = resolvePlanTargets(plan);

  const candidates: ParagraphCandidate[] = [];
  let cursor: string[] = [];

  for (const sentence of clean) {
    const context = buildLocalContext(cursor);

    const cohesion = context
      ? evaluateParagraphCohesionAgainstContext(context, sentence)
      : {
          previous: "",
          current: sentence,
          lexicalOverlap: 0,
          connectorContinuity: 0,
          contrastSignal: 0,
          semanticCohesion: 0.74,
          topicShiftScore: 0.16,
        };

    cursor.push(sentence);

    const chars = sentenceCharLength(cursor);
    const currentSentences = cursor.length;
    const topicShift = cohesion.topicShiftScore;
    const semanticCohesion = cohesion.semanticCohesion;

    const reachedMaxSentence = currentSentences >= maxSentenceTarget;
    const reachedMaxChar = chars >= maxChars;

    const strongTopicShift = shouldTreatAsStrongTopicShift(
      topicShift,
      semanticCohesion,
      currentSentences,
      chars,
      plan,
      minSentenceTarget,
      minChars,
    );

    const forcedSingleSentence =
      currentSentences === 1 &&
      !plan.allowSingleSentenceParagraphs &&
      !reachedMaxChar &&
      !reachedMaxSentence;

    const candidateWantsFlush = reachedMaxSentence || reachedMaxChar || strongTopicShift;

    const delayFlush =
      candidateWantsFlush &&
      shouldDelayFlushForDensity(
        currentSentences,
        chars,
        semanticCohesion,
        topicShift,
        plan,
        minSentenceTarget,
        minChars,
      ) &&
      !reachedMaxSentence &&
      !reachedMaxChar;

    const shouldFlush = !forcedSingleSentence && candidateWantsFlush && !delayFlush;

    if (!shouldFlush) continue;

    candidates.push({
      sentences: [...cursor],
      charLength: chars,
      semanticCohesion,
      topicShiftScore: topicShift,
      shouldFlush,
    });

    cursor = [];
  }

  if (cursor.length) {
    const text = sanitizeText(cursor.join(" "));
    const residualContext =
      cursor.length > 1 ? sanitizeText(cursor.slice(0, -1).join(" ")) : "";

    const residualCohesion =
      cursor.length > 1
        ? evaluateParagraphCohesionAgainstContext(
            residualContext,
            cursor[cursor.length - 1],
          )
        : {
            previous: "",
            current: cursor[0],
            lexicalOverlap: 0,
            connectorContinuity: 0,
            contrastSignal: 0,
            semanticCohesion: sentenceCount(text) <= 1 ? 0.6 : 0.78,
            topicShiftScore: sentenceCount(text) <= 1 ? 0.3 : 0.18,
          };

    candidates.push({
      sentences: [...cursor],
      charLength: sentenceCharLength(cursor),
      semanticCohesion: residualCohesion.semanticCohesion,
      topicShiftScore: residualCohesion.topicShiftScore,
      shouldFlush: true,
    });
  }

  return candidates;
}