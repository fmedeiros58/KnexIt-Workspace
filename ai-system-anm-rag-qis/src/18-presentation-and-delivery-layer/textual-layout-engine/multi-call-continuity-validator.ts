import { ensureUtf8Response } from "../text-encoding-guard";
import type { TextualAuditContext } from "./response-layout-types";

export type MultiCallContinuityValidation = {
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

function stripRoleTranscriptTail(text: string): string {
  const source = `${text || ""}`.trim();
  if (!source) return "";

  const roleTailPattern = /\b(?:usu[aá]rio|usuario|user|assistente|assistant|let[ií]cia|leticia)\s*:\s*/i;
  const match = roleTailPattern.exec(source);
  if (!match || match.index <= 0) return source;

  const head = source.slice(0, match.index).trim();
  return head || source;
}

function sanitizeText(text: string): string {
  const utf8 = ensureUtf8Response(`${text || ""}`).text;
  return collapseWhitespace(stripRoleTranscriptTail(stripDialogueLabels(utf8)));
}

function normalize(text: string): string {
  return sanitizeText(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitParagraphs(text: string): string[] {
  return sanitizeText(text)
    .split(/\n{2,}/g)
    .map((paragraph) => sanitizeText(paragraph))
    .filter(Boolean);
}

function similarityByTokenOverlap(a: string, b: string): number {
  const tokensA = new Set(normalize(a).split(" ").filter((token) => token.length >= 4));
  const tokensB = new Set(normalize(b).split(" ").filter((token) => token.length >= 4));

  if (!tokensA.size || !tokensB.size) return 0;

  let shared = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) shared += 1;
  }

  return shared / Math.max(1, Math.min(tokensA.size, tokensB.size));
}

function containsTranscriptLeak(text: string): boolean {
  return /\b(?:usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/i.test(`${text || ""}`);
}

export function validateMultiCallContinuity(
  text: string,
  context?: TextualAuditContext,
): MultiCallContinuityValidation {
  const discourse = context?.longFormDiscourse;
  const sanitizedText = sanitizeText(text);

  if (!discourse || !discourse.isActive || !discourse.paragraphHistory.length) {
    return { passed: true, score: 0.86, issues: [] };
  }

  const currentParagraphs = splitParagraphs(sanitizedText);
  const currentHead = currentParagraphs[0] || "";
  const previousTail = sanitizeText(
    discourse.paragraphHistory[discourse.paragraphHistory.length - 1] || "",
  );

  if (!currentHead || !previousTail) {
    return { passed: true, score: 0.8, issues: [] };
  }

  const overlap = similarityByTokenOverlap(currentHead, previousTail);
  const issues: string[] = [];

  if (containsTranscriptLeak(text)) {
    issues.push("multi_call_transcript_leak");
  }

  if (overlap >= 0.9) {
    issues.push("multi_call_repetition_risk");
  }

  const transitionRequired = (discourse.transitionPlan || []).length > 0;
  const enoughCurrentMaterial = sanitizeText(currentHead).length >= 90;

  if (transitionRequired && enoughCurrentMaterial && overlap <= 0.03) {
    issues.push("multi_call_transition_break");
  }

  let score = 0.84;
  score -= issues.includes("multi_call_transcript_leak") ? 0.34 : 0;
  score -= issues.includes("multi_call_repetition_risk") ? 0.22 : 0;
  score -= issues.includes("multi_call_transition_break") ? 0.18 : 0;

  if (overlap > 0.08 && overlap < 0.72) {
    score += 0.06;
  }

  score = Math.max(0, Math.min(1, Number(score.toFixed(4))));

  return {
    passed: issues.length === 0,
    score,
    issues,
  };
}