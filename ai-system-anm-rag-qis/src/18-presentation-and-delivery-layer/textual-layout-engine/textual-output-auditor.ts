import { applyHeadingAndListStrategy } from "./heading-list-strategy";
import { mergeParagraphsByPlan } from "./paragraph-merge-decider";
import type { ResponseLayoutPlan, TextualAudit } from "./response-layout-types";

function splitParagraphs(text: string) {
  return `${text || ""}`
    .split(/\n{2,}/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function sentenceCount(text: string) {
  return `${text || ""}`
    .split(/(?<=[.!?])\s+/g)
    .map((segment) => segment.trim())
    .filter(Boolean).length;
}

function hasPseudoList(text: string) {
  return /(^|\n)\s*(?:[-*•]|\d+\.)\s+/m.test(`${text || ""}`);
}

function headingCount(text: string) {
  return (`${text || ""}`.match(/(^|\n)\s*#{1,6}\s+/g) || []).length;
}

function normalizeSpacing(text: string) {
  return `${text || ""}`
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function collectIssues(text: string, plan: ResponseLayoutPlan) {
  const issues: string[] = [];
  const paragraphs = splitParagraphs(text);
  if (!paragraphs.length) {
    issues.push("empty_output");
    return issues;
  }

  const oneSentenceParagraphs = paragraphs.filter((paragraph) => sentenceCount(paragraph) <= 1).length;
  const oneSentenceRatio = oneSentenceParagraphs / Math.max(1, paragraphs.length);
  if (!plan.allowSingleSentenceParagraphs && paragraphs.length >= 3 && oneSentenceRatio >= 0.45) {
    issues.push("excess_one_sentence_paragraphs");
  }

  if (hasPseudoList(text) && plan.listStrategy === "avoid") {
    issues.push("list_not_allowed_for_plan");
  }

  const headings = headingCount(text);
  if (plan.headingStrategy === "none" && headings > 0) {
    issues.push("heading_not_allowed");
  }
  if (plan.headingStrategy === "light" && headings > 2) {
    issues.push("excess_headings_for_light_strategy");
  }
  if ((plan.complexity === "long" || plan.complexity === "deep") && headings === 0 && plan.headingStrategy === "moderate") {
    issues.push("missing_heading_for_deep_output");
  }

  if (/\n{3,}/.test(text)) {
    issues.push("excess_vertical_spacing");
  }

  return issues;
}

function repairText(text: string, plan: ResponseLayoutPlan, issues: string[]) {
  let repaired = `${text || ""}`.trim();
  if (!repaired) return repaired;

  if (issues.includes("list_not_allowed_for_plan") || issues.some((issue) => issue.startsWith("heading_"))) {
    repaired = applyHeadingAndListStrategy(repaired, plan);
  }

  if (issues.includes("excess_one_sentence_paragraphs")) {
    const paragraphs = splitParagraphs(repaired);
    repaired = mergeParagraphsByPlan(paragraphs, plan).join("\n\n");
  }

  repaired = normalizeSpacing(repaired);
  return repaired;
}

export function textualOutputAuditor(text: string, plan: ResponseLayoutPlan): TextualAudit {
  const source = `${text || ""}`.trim();
  const issues = collectIssues(source, plan);
  if (!issues.length) {
    return {
      passed: true,
      score: 0.93,
      issues: [],
    };
  }

  const repaired = repairText(source, plan, issues);
  const finalIssues = collectIssues(repaired, plan);
  const passed = finalIssues.length === 0 || finalIssues.length < issues.length;
  const score = Math.max(0.35, Math.min(0.92, 0.88 - finalIssues.length * 0.1));

  return {
    passed,
    score,
    issues: finalIssues.length ? finalIssues : issues,
    repairedText: repaired !== source ? repaired : undefined,
  };
}
