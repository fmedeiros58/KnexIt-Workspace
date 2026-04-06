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

function normalizedParagraphs(paragraphs: string[]) {
  return (paragraphs || []).map((paragraph) => `${paragraph || ""}`.trim()).filter(Boolean);
}

export function progressiveRevealManager(input: ProgressiveRevealManagerInput): ProgressiveRevealManagerOutput {
  const chunks: StreamChunk[] = [];
  const paragraphs = normalizedParagraphs(input.paragraphs || []);
  const minChunkChars = input.layoutPlan
    ? Math.max(140, Math.floor(input.layoutPlan.targetParagraphCharRange[0] * 0.75))
    : 180;

  let cumulativeText = "";
  let deltaBuffer = "";
  let groupStartIndex = 0;

  const flushGroup = (done = false) => {
    const delta = deltaBuffer.trim();
    if (!delta) return;
    cumulativeText = `${cumulativeText}${cumulativeText ? "\n\n" : ""}${delta}`;
    chunks.push({
      index: chunks.length,
      delta: done ? delta : `${delta}\n\n`,
      cumulativeText,
      done,
    });
    deltaBuffer = "";
    groupStartIndex = chunks.length;
  };

  for (const paragraph of paragraphs) {
    if (!deltaBuffer) {
      deltaBuffer = paragraph;
    } else {
      deltaBuffer = `${deltaBuffer}\n\n${paragraph}`;
    }

    const shouldFlushNow = deltaBuffer.length >= minChunkChars || paragraph.length >= minChunkChars;
    if (!shouldFlushNow) continue;
    flushGroup(false);
  }

  if (deltaBuffer.trim()) {
    flushGroup(true);
  } else if (chunks.length > 0) {
    chunks[chunks.length - 1].done = true;
    chunks[chunks.length - 1].delta = chunks[chunks.length - 1].delta.replace(/\n+$/g, "");
  }

  // Fallback: se nada foi emitido, devolve chunks por parágrafo.
  if (chunks.length === 0 && paragraphs.length > 0) {
    let cumulative = "";
    paragraphs.forEach((paragraph, index) => {
      cumulative = `${cumulative}${cumulative ? "\n\n" : ""}${paragraph}`;
      chunks.push({
        index,
        delta: index === paragraphs.length - 1 ? paragraph : `${paragraph}\n\n`,
        cumulativeText: cumulative,
        done: index === paragraphs.length - 1,
      });
    });
  }

  void groupStartIndex; // evitar warning semântico em futuros ajustes.

  return {
    ok: true,
    component: "progressive-reveal-manager",
    score: chunks.length > 0 ? 0.9 : 0.4,
    chunks,
  };
}
