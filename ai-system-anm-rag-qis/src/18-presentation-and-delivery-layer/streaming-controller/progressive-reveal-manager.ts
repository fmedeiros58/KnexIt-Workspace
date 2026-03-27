import type { StreamChunk } from "../presentation-contracts";

export interface ProgressiveRevealManagerInput {
  paragraphs: string[];
}

export interface ProgressiveRevealManagerOutput {
  ok: boolean;
  component: string;
  score: number;
  chunks: StreamChunk[];
}

export function progressiveRevealManager(input: ProgressiveRevealManagerInput): ProgressiveRevealManagerOutput {
  const chunks: StreamChunk[] = [];
  let cumulativeText = "";

  for (const paragraph of input.paragraphs || []) {
    if (!paragraph) continue;
    cumulativeText = `${cumulativeText}${cumulativeText ? "\n\n" : ""}${paragraph}`;
    chunks.push({
      index: chunks.length,
      delta: `${paragraph}${paragraph.endsWith("\n") ? "" : "\n\n"}`,
      cumulativeText,
      done: false,
    });
  }

  if (chunks.length > 0) {
    chunks[chunks.length - 1].done = true;
    chunks[chunks.length - 1].delta = chunks[chunks.length - 1].delta.replace(/\n+$/g, "");
  }

  return {
    ok: true,
    component: "progressive-reveal-manager",
    score: chunks.length > 0 ? 0.9 : 0.4,
    chunks,
  };
}
