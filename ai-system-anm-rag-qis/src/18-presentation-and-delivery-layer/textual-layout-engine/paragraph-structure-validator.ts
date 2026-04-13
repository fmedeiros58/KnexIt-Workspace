import { ensureUtf8Response } from "../text-encoding-guard";
import type { ResponseLayoutPlan } from "./response-layout-types";

export type ParagraphStructureValidation = {
  passed: boolean;
  paragraphCount: number;
  oneSentenceCount: number;
  oneSentenceRatio: number;
  monoblockDetected: boolean;
  fragmentationDetected: boolean;
  issues: string[];
};

function collapseWhitespace(text: string): string {
  return `${text || ""}`
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function stripDialogueLabels(text: string): string {
  return `${text || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, "\n")
    .trim();
}

function stripRoleTranscriptTail(text: string): string {
  const source = `${text || ""}`.trim();
  if (!source) return "";

  const roleTailPattern = /\b(?:usu[aá]rio|usuario|user|assistente|assistant|let[ií]cia|leticia)\s*:\s*/i;
  const match = roleTailPattern.exec(source);
  if (!match || match.index <= 0) return source;

  const head = source.slice(0, match.index).trim();
  return head || source;
}

function normalizeText(text: string): string {
  const utf8 = ensureUtf8Response(`${text || ""}`).text;
  return collapseWhitespace(stripRoleTranscriptTail(stripDialogueLabels(utf8)));
}

function splitParagraphs(text: string): string[] {
  return normalizeText(text)
    .split(/\n{2,}/g)
    .map((paragraph) => normalizeText(paragraph))
    .filter(Boolean);
}

function isStructuralParagraph(text: string): boolean {
  const value = `${text || ""}`.trim();
  if (!value) return false;

  return (
    /^#{1,6}\s+/.test(value) ||
    /^([-*•]|\d+\.)\s+/.test(value) ||
    /^```/.test(value)
  );
}

function sentenceCount(text: string): number {
  const parts = normalizeText(text)
    .split(/(?<=[.!?])\s+/g)
    .map((segment) => segment.trim())
    .filter(Boolean);

  return parts.length || (normalizeText(text) ? 1 : 0);
}

function normalizeForCompare(text: string): string {
  return `${normalizeText(text) || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function dedupeParagraphs(paragraphs: string[]): string[] {
  const result: string[] = [];

  for (const paragraph of paragraphs) {
    const cleaned = normalizeText(paragraph);
    if (!cleaned) continue;

    const previous = result[result.length - 1];
    if (previous && areNearDuplicates(previous, cleaned)) {
      continue;
    }

    result.push(cleaned);
  }

  return result;
}

function charCount(text: string): number {
  return normalizeText(text).length;
}

export function validateParagraphStructure(
  text: string,
  plan: ResponseLayoutPlan,
): ParagraphStructureValidation {
  const paragraphs = dedupeParagraphs(splitParagraphs(text));
  const eligibleParagraphs = paragraphs.filter((paragraph) => !isStructuralParagraph(paragraph));

  const oneSentenceCount = eligibleParagraphs.filter(
    (paragraph) => sentenceCount(paragraph) <= 1,
  ).length;

  const oneSentenceRatio = oneSentenceCount / Math.max(1, eligibleParagraphs.length);
  const totalChars = normalizeText(text).length;
  const deepLike = plan.complexity === "long" || plan.complexity === "deep" || plan.keepDenseParagraphs;

  const monoblockDetected =
    deepLike &&
    eligibleParagraphs.length === 1 &&
    totalChars >= 800 &&
    sentenceCount(eligibleParagraphs[0] || "") >= Math.max(5, plan.targetParagraphSentenceRange[1] + 1);

  const fragmentationDetected =
    eligibleParagraphs.length >= 4 &&
    !plan.allowSingleSentenceParagraphs &&
    (
      oneSentenceRatio >= 0.45 ||
      eligibleParagraphs.filter((paragraph) => charCount(paragraph) < Math.max(80, plan.targetParagraphCharRange[0] * 0.72)).length /
        Math.max(1, eligibleParagraphs.length) >= 0.4
    );

  const issues: string[] = [];
  if (monoblockDetected) issues.push("monoblock_detected_for_long_form");
  if (fragmentationDetected) issues.push("fragmentation_detected_for_long_form");
  if (paragraphs.length === 0) issues.push("empty_paragraph_structure");

  return {
    passed: issues.length === 0,
    paragraphCount: paragraphs.length,
    oneSentenceCount,
    oneSentenceRatio: Number(oneSentenceRatio.toFixed(4)),
    monoblockDetected,
    fragmentationDetected,
    issues,
  };
}