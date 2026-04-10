import type { StreamChunk } from "../presentation-contracts";
import { ensureUtf8Response } from "../text-encoding-guard";

export interface StreamRecoveryManagerInput {
  chunks: StreamChunk[];
  fallbackText: string;
}

export interface StreamRecoveryManagerOutput {
  ok: boolean;
  component: string;
  score: number;
  chunks: StreamChunk[];
  recovered: boolean;
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

function splitParagraphs(text: string): string[] {
  return `${text || ""}`
    .split(/\n{2,}/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function dedupeConsecutiveParagraphs(text: string): string {
  const paragraphs = splitParagraphs(text);
  if (paragraphs.length <= 1) return `${text || ""}`.trim();

  const kept: string[] = [];

  for (const paragraph of paragraphs) {
    const last = kept[kept.length - 1];
    if (!last) {
      kept.push(paragraph);
      continue;
    }

    if (normalizeForCompare(last) === normalizeForCompare(paragraph)) {
      continue;
    }

    kept.push(paragraph);
  }

  return kept.join("\n\n").trim();
}

function collapseDuplicatedHalves(text: string): string {
  const source = `${text || ""}`.trim();
  if (!source || source.length < 260) return source;

  const sentences = source
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((row) => row.trim())
    .filter(Boolean);

  if (sentences.length < 8) return source;

  const midpoint = Math.floor(sentences.length / 2);
  const firstHalf = sentences.slice(0, midpoint);
  const secondHalf = sentences.slice(midpoint, midpoint + firstHalf.length);

  if (firstHalf.length < 3 || secondHalf.length < 3) return source;

  let equal = 0;
  const comparable = Math.min(firstHalf.length, secondHalf.length);

  for (let index = 0; index < comparable; index += 1) {
    if (normalizeForCompare(firstHalf[index]) === normalizeForCompare(secondHalf[index])) {
      equal += 1;
    }
  }

  const ratio = equal / Math.max(1, comparable);
  if (ratio < 0.65) return source;

  return firstHalf.join(" ").trim();
}

function sanitizeRecoveryText(value: string): string {
  const utf8 = ensureUtf8Response(`${value || ""}`).text;
  const withoutLabels = stripDialogueLabels(utf8);
  const withoutTail = stripRoleTranscriptTail(withoutLabels);
  const deduped = dedupeConsecutiveParagraphs(withoutTail);
  const collapsed = collapseDuplicatedHalves(deduped);
  return collapseWhitespace(collapsed);
}

function sanitizeChunks(chunks: StreamChunk[]): StreamChunk[] {
  const sanitized: StreamChunk[] = [];
  let cumulative = "";

  for (let index = 0; index < (chunks || []).length; index += 1) {
    const chunk = chunks[index];
    const delta = sanitizeRecoveryText(chunk?.delta || "");
    const candidateCumulative = sanitizeRecoveryText(chunk?.cumulativeText || "");

    const nextCumulative =
      candidateCumulative ||
      sanitizeRecoveryText(`${cumulative} ${delta}`.trim());

    if (!delta && !nextCumulative && !chunk?.done) {
      continue;
    }

    cumulative = nextCumulative;

    sanitized.push({
      index: sanitized.length,
      delta,
      cumulativeText: cumulative,
      done: Boolean(chunk?.done),
    });
  }

  if (sanitized.length > 0) {
    sanitized[sanitized.length - 1] = {
      ...sanitized[sanitized.length - 1],
      done: true,
    };
  }

  return sanitized;
}

export function streamRecoveryManager(
  input: StreamRecoveryManagerInput,
): StreamRecoveryManagerOutput {
  const sanitizedChunks = sanitizeChunks([...(input.chunks || [])]);

  if (sanitizedChunks.length > 0) {
    return {
      ok: true,
      component: "stream-recovery-manager",
      score: 0.92,
      chunks: sanitizedChunks,
      recovered: false,
    };
  }

  const fallbackText = sanitizeRecoveryText(input.fallbackText || "");
  if (!fallbackText) {
    return {
      ok: true,
      component: "stream-recovery-manager",
      score: 0.32,
      chunks: [],
      recovered: false,
    };
  }

  const fallbackChunk: StreamChunk = {
    index: 0,
    delta: fallbackText,
    cumulativeText: fallbackText,
    done: true,
  };

  return {
    ok: true,
    component: "stream-recovery-manager",
    score: 0.74,
    chunks: [fallbackChunk],
    recovered: true,
  };
}