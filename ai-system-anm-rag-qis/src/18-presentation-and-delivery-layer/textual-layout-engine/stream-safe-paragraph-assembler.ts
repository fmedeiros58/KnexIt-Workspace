import { buildParagraphCandidatesFromSentences } from "./paragraph-cohesion-engine";
import { mergeParagraphsByPlan } from "./paragraph-merge-decider";
import type { ParagraphAssemblerInput, ParagraphAssemblerOutput } from "./response-layout-types";

function normalize(text: string) {
  return `${text || ""}`.replace(/\s+/g, " ").trim();
}

function flattenCandidatesToParagraphs(candidates: ParagraphAssemblerOutput["candidates"]) {
  return candidates
    .map((candidate) => candidate.sentences.join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function streamSafeParagraphAssembler(input: ParagraphAssemblerInput): ParagraphAssemblerOutput {
  const candidates = buildParagraphCandidatesFromSentences(input.sentences || [], input.plan);
  if (!candidates.length) return { paragraphs: [], candidates: [] };

  const baseParagraphs = flattenCandidatesToParagraphs(candidates);
  const mergedParagraphs = mergeParagraphsByPlan(baseParagraphs, input.plan);

  const paragraphs: string[] = [];
  for (const paragraph of mergedParagraphs) {
    const normalized = normalize(paragraph);
    if (!normalized) continue;
    const previous = paragraphs.length ? paragraphs[paragraphs.length - 1] : "";
    if (previous && normalized === previous) continue;
    paragraphs.push(normalized);
  }

  return {
    paragraphs,
    candidates,
  };
}
