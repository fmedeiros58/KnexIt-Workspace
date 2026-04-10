import { ensureUtf8Response } from "../text-encoding-guard";
import { evaluateParagraphCohesion } from "./paragraph-cohesion-engine";
import type { ResponseLayoutPlan } from "./response-layout-types";

export type DiscourseCohesionValidation = {
  passed: boolean;
  score: number;
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

function normalizeParagraph(text: string): string {
  const utf8 = ensureUtf8Response(`${text || ""}`).text;
  return collapseWhitespace(stripDialogueLabels(utf8));
}

function splitParagraphs(text: string): string[] {
  return normalizeParagraph(text)
    .split(/\n{2,}/g)
    .map((paragraph) => normalizeParagraph(paragraph))
    .filter(Boolean);
}

function isStructuralParagraph(text: string): boolean {
  const value = `${text || ""}`.trim();
  if (!value) return false;

  return (
    /^#{1,6}\s+/.test(value) ||
    /^([-*•]|\d+\.)\s+/.test(value) ||
    /^```/.test(value) ||
    /^(conclusao|conclusão|sintese|síntese|fechamento|fontes|referencias|referências)\s*:?\s*$/i.test(value)
  );
}

function normalizeForCompare(text: string): string {
  return `${normalizeParagraph(text) || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeParagraphs(paragraphs: string[]): string[] {
  const result: string[] = [];

  for (const paragraph of paragraphs) {
    const cleaned = normalizeParagraph(paragraph);
    if (!cleaned) continue;

    const previous = result[result.length - 1];
    if (previous && normalizeForCompare(previous) === normalizeForCompare(cleaned)) {
      continue;
    }

    result.push(cleaned);
  }

  return result;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function validateDiscourseCohesion(
  text: string,
  plan: ResponseLayoutPlan,
): DiscourseCohesionValidation {
  const paragraphs = dedupeParagraphs(splitParagraphs(text));

  if (paragraphs.length <= 1) {
    return { passed: true, score: 0.88, issues: [] };
  }

  let cohesionSum = 0;
  let transitionCount = 0;
  const issues: string[] = [];

  for (let index = 1; index < paragraphs.length; index += 1) {
    const previous = paragraphs[index - 1];
    const current = paragraphs[index];

    if (isStructuralParagraph(previous) || isStructuralParagraph(current)) {
      continue;
    }

    const sample = evaluateParagraphCohesion(previous, current);
    transitionCount += 1;
    cohesionSum += sample.semanticCohesion;

    const abruptThreshold =
      plan.complexity === "deep" || plan.complexity === "long"
        ? Math.max(0.8, plan.flushThreshold + 0.16)
        : Math.max(0.74, plan.flushThreshold + 0.12);

    if (
      sample.topicShiftScore >= abruptThreshold &&
      sample.semanticCohesion < 0.34 &&
      sample.connectorContinuity === 0
    ) {
      issues.push(`abrupt_topic_shift_at_${index}`);
    }
  }

  if (transitionCount === 0) {
    return { passed: true, score: 0.86, issues: [] };
  }

  const avgCohesion = cohesionSum / Math.max(1, transitionCount);

  let score = 0.52 + avgCohesion * 0.4 - issues.length * 0.12;

  if ((plan.complexity === "long" || plan.complexity === "deep") && avgCohesion < 0.24) {
    issues.push("low_global_discourse_cohesion");
    score -= 0.08;
  }

  score = clamp01(score);

  return {
    passed: issues.length === 0,
    score,
    issues,
  };
}