import { ensureUtf8Response } from "../text-encoding-guard";
import type { TextualAuditContext } from "./response-layout-types";

export type LongFormMemoryConsumptionValidation = {
  passed: boolean;
  score: number;
  usedMemory: boolean;
  issues: string[];
};

function collapseWhitespace(value: string): string {
  return `${value || ""}`
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
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

function sanitizeText(value: string): string {
  const utf8 = ensureUtf8Response(`${value || ""}`).text;
  return collapseWhitespace(stripRoleTranscriptTail(stripDialogueLabels(utf8)));
}

function normalize(value: string): string {
  return sanitizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);
}

function similarityByTokenOverlap(a: string, b: string): number {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));

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

function splitParagraphs(text: string): string[] {
  return sanitizeText(text)
    .split(/\n{2,}/g)
    .map((paragraph) => sanitizeText(paragraph))
    .filter(Boolean);
}

function resolveAnchors(rawAnchors: string[]): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const anchor of rawAnchors || []) {
    const cleaned = sanitizeText(anchor);
    const normalized = normalize(cleaned);

    if (!cleaned || normalized.length < 4) continue;
    if (seen.has(normalized)) continue;

    seen.add(normalized);
    unique.push(cleaned);
  }

  return unique.slice(0, 14);
}

function estimateAnchorUsage(text: string, anchors: string[]): {
  hits: number;
  hitRatio: number;
  strongestMatch: number;
} {
  const paragraphs = splitParagraphs(text);
  const textNormalized = normalize(text);

  let hits = 0;
  let strongestMatch = 0;

  for (const anchor of anchors) {
    const exactHit = textNormalized.includes(normalize(anchor));
    let localBest = exactHit ? 1 : 0;

    if (!exactHit) {
      for (const paragraph of paragraphs) {
        const similarity = similarityByTokenOverlap(anchor, paragraph);
        if (similarity > localBest) {
          localBest = similarity;
        }
      }
    }

    if (localBest >= 0.34) {
      hits += 1;
    }

    if (localBest > strongestMatch) {
      strongestMatch = localBest;
    }
  }

  const hitRatio = hits / Math.max(1, anchors.length);
  return {
    hits,
    hitRatio,
    strongestMatch,
  };
}

export function validateLongFormMemoryConsumption(
  text: string,
  context?: TextualAuditContext,
): LongFormMemoryConsumptionValidation {
  const discourse = context?.longFormDiscourse;
  const sanitizedText = sanitizeText(text);

  if (!discourse || !discourse.isActive) {
    return { passed: true, score: 0.82, usedMemory: false, issues: [] };
  }

  const anchors = resolveAnchors(discourse.memoryAnchors || []);
  const transcriptLeak = containsTranscriptLeak(text);

  if (anchors.length === 0) {
    const usedMemory = Boolean(discourse.usesWorkingMemory) && sanitizedText.length >= 80 && !transcriptLeak;

    return {
      passed: usedMemory,
      score: usedMemory ? 0.84 : discourse.usesWorkingMemory ? 0.68 : 0.62,
      usedMemory,
      issues: usedMemory
        ? []
        : discourse.usesWorkingMemory
          ? ["long_form_memory_not_bound"]
          : ["long_form_memory_unavailable"],
    };
  }

  const usage = estimateAnchorUsage(sanitizedText, anchors);

  const usedMemory =
    Boolean(discourse.usesWorkingMemory) &&
    !transcriptLeak &&
    (
      usage.hitRatio >= 0.18 ||
      (usage.hits >= 2 && usage.strongestMatch >= 0.28) ||
      usage.strongestMatch >= 0.52
    );

  let score = 0.34 + usage.hitRatio * 0.46 + usage.strongestMatch * 0.22;
  if (transcriptLeak) score -= 0.22;
  score = Math.max(0, Math.min(1, Number(score.toFixed(4))));

  const issues: string[] = [];
  if (transcriptLeak) issues.push("long_form_memory_transcript_leak");
  if (!usedMemory) issues.push("long_form_memory_anchor_underused");

  return {
    passed: issues.length === 0,
    score,
    usedMemory,
    issues,
  };
}