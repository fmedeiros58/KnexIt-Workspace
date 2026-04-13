import { ensureUtf8Response } from "../text-encoding-guard";
import type { StreamChunk } from "../presentation-contracts";
import type { ResponseLayoutPlan } from "../textual-layout-engine/response-layout-types";

export interface ProgressiveRevealManagerInput {
  paragraphs: string[];
  layoutPlan?: ResponseLayoutPlan;
}

export interface ProgressiveRevealManagerOutput {
  ok: boolean;
  component: string;
  score: number;
  chunks: StreamChunk[];
}

interface ChunkTargets {
  minChunkChars: number;
  maxChunkChars: number;
  groupParagraphTarget: number;
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

function stripDialogueLabels(value: string): string {
  return `${value || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, "\n")
    .trim();
}

function stripRoleTranscriptTail(value: string): string {
  const source = `${value || ""}`.trim();
  if (!source) return "";

  const roleTailPattern = /\b(?:usu[aá]rio|usuario|user|assistente|assistant|let[ií]cia|leticia)\s*:\s*/i;
  const match = roleTailPattern.exec(source);
  if (!match || match.index <= 0) return source;

  const head = source.slice(0, match.index).trim();
  return head || source;
}

function sanitizeRevealText(value: string): string {
  const utf8 = ensureUtf8Response(`${value || ""}`).text;
  const withoutLabels = stripDialogueLabels(utf8);
  const withoutTail = stripRoleTranscriptTail(withoutLabels);
  return collapseWhitespace(withoutTail);
}

function normalizedParagraphs(paragraphs: string[]) {
  const output: string[] = [];

  for (const paragraph of paragraphs || []) {
    const cleaned = sanitizeRevealText(paragraph);
    if (!cleaned) continue;

    const last = output[output.length - 1];
    if (last && normalizeForCompare(last) === normalizeForCompare(cleaned)) {
      continue;
    }

    output.push(cleaned);
  }

  return output;
}

function splitSentences(text: string): string[] {
  return `${text || ""}`
    .split(/(?<=[.!?])\s+/g)
    .map((sentence) => sanitizeRevealText(sentence))
    .filter(Boolean);
}

function joinParagraphGroup(paragraphs: string[]): string {
  return paragraphs.map((item) => sanitizeRevealText(item)).filter(Boolean).join("\n\n").trim();
}

function resolveChunkTargets(layoutPlan?: ResponseLayoutPlan): ChunkTargets {
  const complexity = `${layoutPlan?.complexity || ""}`.trim().toLowerCase();
  const denseGrouping = Boolean(layoutPlan?.keepDenseParagraphs);

  const minChunkChars = layoutPlan
    ? Math.max(
        complexity === "deep" ? 220 : 160,
        Math.floor(layoutPlan.targetParagraphCharRange[0] * 0.8),
      )
    : 220;

  const maxChunkChars = layoutPlan
    ? Math.max(
        minChunkChars + 80,
        Math.floor(layoutPlan.targetParagraphCharRange[1] * (denseGrouping ? 1.35 : 1.15)),
      )
    : 520;

  const groupParagraphTarget =
    denseGrouping || complexity === "deep" || complexity === "long"
      ? 2
      : 1;

  return {
    minChunkChars,
    maxChunkChars,
    groupParagraphTarget,
  };
}

function pushChunk(
  chunks: StreamChunk[],
  deltaText: string,
  cumulativeBefore: string,
  done: boolean,
): string {
  const delta = sanitizeRevealText(deltaText);
  if (!delta) return cumulativeBefore;

  const cumulativeText = sanitizeRevealText(
    `${cumulativeBefore}${cumulativeBefore ? "\n\n" : ""}${delta}`.trim(),
  );

  const previous = chunks[chunks.length - 1];
  if (previous) {
    const sameDelta = normalizeForCompare(previous.delta) === normalizeForCompare(delta);
    const sameCumulative = normalizeForCompare(previous.cumulativeText) === normalizeForCompare(cumulativeText);

    if (sameDelta || sameCumulative) {
      previous.done = previous.done || done;
      previous.delta = sanitizeRevealText(previous.delta);
      previous.cumulativeText = sanitizeRevealText(previous.cumulativeText);
      return previous.cumulativeText;
    }
  }

  chunks.push({
    index: chunks.length,
    delta: done ? delta : `${delta}\n\n`,
    cumulativeText,
    done,
  });

  return cumulativeText;
}

export function progressiveRevealManager(
  input: ProgressiveRevealManagerInput,
): ProgressiveRevealManagerOutput {
  const chunks: StreamChunk[] = [];
  const paragraphs = normalizedParagraphs(input.paragraphs || []);
  const targets = resolveChunkTargets(input.layoutPlan);

  let cumulativeText = "";
  let paragraphBuffer: string[] = [];

  const flushGroup = (done = false) => {
    const delta = joinParagraphGroup(paragraphBuffer);
    if (!delta) return;

    cumulativeText = pushChunk(chunks, delta, cumulativeText, done);
    paragraphBuffer = [];
  };

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    paragraphBuffer.push(paragraph);

    const joined = joinParagraphGroup(paragraphBuffer);
    const isLastParagraph = index === paragraphs.length - 1;

    const reachedMinSize = joined.length >= targets.minChunkChars;
    const reachedMaxSize = joined.length >= targets.maxChunkChars;
    const reachedGroupTarget = paragraphBuffer.length >= targets.groupParagraphTarget;

    const shouldFlushNow =
      reachedMaxSize ||
      (reachedMinSize && reachedGroupTarget) ||
      (isLastParagraph && joined.length >= targets.minChunkChars);

    if (!shouldFlushNow) continue;

    flushGroup(isLastParagraph);
  }

  if (paragraphBuffer.length > 0) {
    flushGroup(true);
  } else if (chunks.length > 0) {
    const last = chunks[chunks.length - 1];
    last.done = true;
    last.delta = sanitizeRevealText(last.delta.replace(/\n+$/g, ""));
    last.cumulativeText = sanitizeRevealText(last.cumulativeText);
  }

  if (chunks.length === 0 && paragraphs.length > 0) {
    let cumulative = "";

    for (let index = 0; index < paragraphs.length; index += 1) {
      const paragraph = sanitizeRevealText(paragraphs[index]);
      if (!paragraph) continue;

      cumulative = sanitizeRevealText(`${cumulative}${cumulative ? "\n\n" : ""}${paragraph}`);

      chunks.push({
        index: chunks.length,
        delta: index === paragraphs.length - 1 ? paragraph : `${paragraph}\n\n`,
        cumulativeText: cumulative,
        done: index === paragraphs.length - 1,
      });
    }
  }

  if (
    chunks.length === 1 &&
    (splitSentences(cumulativeText).length >= 5 || paragraphs.length >= 3) &&
    cumulativeText.length >= Math.max(280, Math.floor(targets.minChunkChars * 1.2))
  ) {
    const sourceForSplit =
      paragraphs.length >= 3
        ? paragraphs
        : splitSentences(cumulativeText).length >= 5
          ? splitSentences(cumulativeText)
          : [];

    const midpoint = Math.ceil(sourceForSplit.length / 2);
    const first = sourceForSplit
      .slice(0, midpoint)
      .join(paragraphs.length >= 3 ? "\n\n" : " ")
      .trim();

    const second = sourceForSplit
      .slice(midpoint)
      .join(paragraphs.length >= 3 ? "\n\n" : " ")
      .trim();

    if (first && second) {
      const firstClean = sanitizeRevealText(first);
      const secondClean = sanitizeRevealText(second);

      chunks.length = 0;
      chunks.push({
        index: 0,
        delta: `${firstClean}\n\n`,
        cumulativeText: firstClean,
        done: false,
      });
      chunks.push({
        index: 1,
        delta: secondClean,
        cumulativeText: sanitizeRevealText(`${firstClean}\n\n${secondClean}`),
        done: true,
      });
    }
  }

  if (chunks.length > 0) {
    chunks[chunks.length - 1] = {
      ...chunks[chunks.length - 1],
      done: true,
      delta: sanitizeRevealText(chunks[chunks.length - 1].delta.replace(/\n+$/g, "")),
      cumulativeText: sanitizeRevealText(chunks[chunks.length - 1].cumulativeText),
    };
  }

  return {
    ok: true,
    component: "progressive-reveal-manager",
    score: chunks.length > 0 ? 0.9 : 0.4,
    chunks,
  };
}