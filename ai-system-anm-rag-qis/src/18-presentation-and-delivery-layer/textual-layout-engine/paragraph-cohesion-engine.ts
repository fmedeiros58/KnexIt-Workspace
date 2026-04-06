import type { ParagraphCandidate, ParagraphCohesionSample, ResponseLayoutPlan } from "./response-layout-types";

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

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalize(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function lexicalOverlap(previous: string, current: string) {
  const prev = new Set(tokenize(previous));
  const curr = new Set(tokenize(current));
  if (!prev.size || !curr.size) return 0;
  let shared = 0;
  for (const token of prev) if (curr.has(token)) shared += 1;
  return shared / Math.max(1, Math.min(prev.size, curr.size));
}

function connectorContinuity(current: string) {
  const normalized = normalize(current);
  if (!normalized) return 0;
  return CONTINUITY_CONNECTORS.some((connector) => normalized.startsWith(connector)) ? 1 : 0;
}

function contrastSignal(current: string) {
  const normalized = normalize(current);
  if (!normalized) return 0;
  return CONTRAST_CONNECTORS.some((connector) => normalized.startsWith(connector)) ? 1 : 0;
}

export function evaluateParagraphCohesion(previous: string, current: string): ParagraphCohesionSample {
  const overlap = lexicalOverlap(previous, current);
  const continuity = connectorContinuity(current);
  const contrast = contrastSignal(current);
  const semanticCohesion = Math.max(0, Math.min(1, overlap * 0.65 + continuity * 0.35 - contrast * 0.2));
  const topicShiftScore = Math.max(0, Math.min(1, (1 - overlap) * 0.7 + contrast * 0.3));

  return {
    previous,
    current,
    lexicalOverlap: overlap,
    connectorContinuity: continuity,
    contrastSignal: contrast,
    semanticCohesion,
    topicShiftScore,
  };
}

function sentenceCharLength(sentences: string[]) {
  return sentences.join(" ").replace(/\s+/g, " ").trim().length;
}

function sentenceCount(text: string) {
  const segments = `${text || ""}`.split(/(?<=[.!?])\s+/g).map((segment) => segment.trim()).filter(Boolean);
  return segments.length || (text.trim() ? 1 : 0);
}

export function buildParagraphCandidatesFromSentences(
  sentences: string[],
  plan: ResponseLayoutPlan,
): ParagraphCandidate[] {
  const clean = (sentences || []).map((sentence) => `${sentence || ""}`.trim()).filter(Boolean);
  if (!clean.length) return [];

  const minSentenceTarget = Math.max(1, plan.targetParagraphSentenceRange[0]);
  const maxSentenceTarget = Math.max(minSentenceTarget, plan.targetParagraphSentenceRange[1]);
  const maxChars = Math.max(120, plan.targetParagraphCharRange[1]);
  const candidates: ParagraphCandidate[] = [];
  let cursor: string[] = [];

  for (const sentence of clean) {
    const previous = cursor.length ? cursor[cursor.length - 1] : "";
    const cohesion = previous ? evaluateParagraphCohesion(previous, sentence) : null;
    cursor.push(sentence);
    const chars = sentenceCharLength(cursor);
    const currentSentences = cursor.length;
    const topicShift = cohesion?.topicShiftScore ?? 0;
    const semanticCohesion = cohesion?.semanticCohesion ?? 1;

    const reachedMaxSentence = currentSentences >= maxSentenceTarget;
    const reachedMaxChar = chars >= maxChars;
    const strongTopicShift = topicShift >= plan.flushThreshold && currentSentences >= minSentenceTarget;
    const forcedSingleSentence =
      currentSentences === 1 &&
      !plan.allowSingleSentenceParagraphs &&
      !reachedMaxChar &&
      !reachedMaxSentence;

    const shouldFlush = !forcedSingleSentence && (reachedMaxSentence || reachedMaxChar || strongTopicShift);

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
    const text = cursor.join(" ").trim();
    candidates.push({
      sentences: [...cursor],
      charLength: sentenceCharLength(cursor),
      semanticCohesion: sentenceCount(text) <= 1 ? 0.5 : 0.78,
      topicShiftScore: 0.22,
      shouldFlush: true,
    });
  }

  return candidates;
}
