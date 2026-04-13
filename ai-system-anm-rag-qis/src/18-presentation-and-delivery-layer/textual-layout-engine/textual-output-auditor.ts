import { runAntiFragmentationGate } from "./anti-fragmentation-gate";
import { runAntiMonoblockGate } from "./anti-monoblock-gate";
import { validateDiscourseCohesion } from "./discourse-cohesion-validator";
import { applyHeadingAndListStrategy } from "./heading-list-strategy";
import { validateLongFormMemoryConsumption } from "./long-form-memory-consumption-validator";
import { mergeParagraphsByPlan } from "./paragraph-merge-decider";
import { validateParagraphStructure } from "./paragraph-structure-validator";
import type {
  ResponseLayoutPlan,
  TextualAudit,
  TextualAuditContext,
} from "./response-layout-types";
import { validateMultiCallContinuity } from "./multi-call-continuity-validator";

function splitParagraphs(text: string): string[] {
  return `${text || ""}`
    .split(/\n{2,}/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function sentenceCount(text: string): number {
  return `${text || ""}`
    .split(/(?<=[.!?])\s+/g)
    .map((segment) => segment.trim())
    .filter(Boolean).length;
}

function hasPseudoList(text: string): boolean {
  return /(^|\n)\s*(?:[-*•]|\d+\.)\s+/m.test(`${text || ""}`);
}

function headingCount(text: string): number {
  return (`${text || ""}`.match(/(^|\n)\s*#{1,6}\s+/g) || []).length;
}

function normalizeSpacing(text: string): string {
  return `${text || ""}`
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function averageParagraphSentenceCount(paragraphs: string[]): number {
  if (!paragraphs.length) return 0;
  const total = paragraphs.reduce((sum, paragraph) => sum + sentenceCount(paragraph), 0);
  return total / paragraphs.length;
}

function endsWithAbruptTail(text: string): boolean {
  const normalized = `${text || ""}`.trim();
  if (!normalized) return false;

  if (/[,:;(\-–—]\s*$/.test(normalized)) return true;
  if (
    /(?:\b(e|mas|ou|que|quando|enquanto|porque|pois|portanto|entretanto|contudo|todavia|logo|assim|por isso)\s*)$/i.test(
      normalized,
    )
  ) {
    return true;
  }

  const lastLine = normalized.split("\n").filter(Boolean).pop() || "";
  if (/^#{1,6}\s+\S*$/.test(lastLine)) return true;

  const safelyClosed =
    /[.!?]["')\]]?\s*$/.test(normalized) ||
    /```[\s\S]*```$/.test(normalized);

  return !safelyClosed;
}

function listStrategyValue(plan: ResponseLayoutPlan): string {
  return String((plan as { listStrategy?: unknown }).listStrategy || "").toLowerCase();
}

function headingStrategyValue(plan: ResponseLayoutPlan): string {
  return String((plan as { headingStrategy?: unknown }).headingStrategy || "").toLowerCase();
}

function getValidationIssues(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const issues = (value as { issues?: unknown }).issues;
  return Array.isArray(issues) ? issues.map((item) => `${item || ""}`.trim()).filter(Boolean) : [];
}

function getValidationPassed(value: unknown): boolean | null {
  if (!value || typeof value !== "object") return null;
  const passed = (value as { passed?: unknown }).passed;
  return typeof passed === "boolean" ? passed : null;
}

function getValidationScore(value: unknown): number {
  if (!value || typeof value !== "object") return 0.5;

  const maybeScore = (value as { score?: unknown }).score;
  if (typeof maybeScore === "number" && Number.isFinite(maybeScore)) {
    return Math.max(0, Math.min(1, maybeScore));
  }

  const passed = getValidationPassed(value);
  const issues = getValidationIssues(value);

  if (passed === true && issues.length === 0) return 0.92;
  if (passed === false && issues.length > 0) return Math.max(0.2, 0.72 - issues.length * 0.08);
  if (issues.length === 0) return 0.78;

  return Math.max(0.22, 0.74 - issues.length * 0.07);
}

function collectCoreIssues(text: string, plan: ResponseLayoutPlan): string[] {
  const issues: string[] = [];
  const paragraphs = splitParagraphs(text);
  const listStrategy = listStrategyValue(plan);
  const headingStrategy = headingStrategyValue(plan);

  if (!paragraphs.length) {
    issues.push("empty_output");
    return issues;
  }

  const oneSentenceParagraphs = paragraphs.filter(
    (paragraph) => sentenceCount(paragraph) <= 1,
  ).length;
  const shortParagraphs = paragraphs.filter(
    (paragraph) => sentenceCount(paragraph) <= 2,
  ).length;

  const oneSentenceRatio = oneSentenceParagraphs / Math.max(1, paragraphs.length);
  const shortParagraphRatio = shortParagraphs / Math.max(1, paragraphs.length);
  const avgSentences = averageParagraphSentenceCount(paragraphs);

  if (
    !plan.allowSingleSentenceParagraphs &&
    paragraphs.length >= 3 &&
    oneSentenceRatio >= 0.45
  ) {
    issues.push("excess_one_sentence_paragraphs");
  }

  if (
    plan.keepDenseParagraphs &&
    paragraphs.length >= 3 &&
    shortParagraphRatio >= 0.5
  ) {
    issues.push("excess_short_paragraphs_for_dense_output");
  }

  if (
    plan.keepDenseParagraphs &&
    avgSentences < Math.max(2.5, plan.targetParagraphSentenceRange[0] - 0.5)
  ) {
    issues.push("weak_paragraph_density");
  }

  if (hasPseudoList(text) && listStrategy === "avoid") {
    issues.push("list_not_allowed_for_plan");
  }

  if (
    hasPseudoList(text) &&
    plan.keepDenseParagraphs &&
    listStrategy !== "prefer"
  ) {
    issues.push("pseudo_list_in_dense_output");
  }

  const headings = headingCount(text);
  if (headingStrategy === "none" && headings > 0) {
    issues.push("heading_not_allowed");
  }
  if (headingStrategy === "light" && headings > 2) {
    issues.push("excess_headings_for_light_strategy");
  }
  if (
    (plan.complexity === "long" || plan.complexity === "deep") &&
    headings === 0 &&
    headingStrategy === "moderate"
  ) {
    issues.push("missing_heading_for_deep_output");
  }

  if (/\n{3,}/.test(text)) {
    issues.push("excess_vertical_spacing");
  }

  if (endsWithAbruptTail(text)) {
    issues.push("possible_truncated_output");
  }

  return issues;
}

function repairParagraphDensity(text: string, plan: ResponseLayoutPlan): string {
  const paragraphs = splitParagraphs(text);
  if (paragraphs.length <= 1) return normalizeSpacing(text);

  let merged = mergeParagraphsByPlan(paragraphs, plan);
  merged = mergeParagraphsByPlan(merged, plan);

  return normalizeSpacing(merged.join("\n\n"));
}

function repairCoreStructure(
  text: string,
  plan: ResponseLayoutPlan,
  issues: string[],
): string {
  let repaired = `${text || ""}`.trim();
  if (!repaired) return repaired;

  const shouldRepairStructure =
    issues.includes("list_not_allowed_for_plan") ||
    issues.includes("heading_not_allowed") ||
    issues.includes("excess_headings_for_light_strategy") ||
    issues.includes("missing_heading_for_deep_output") ||
    issues.includes("pseudo_list_in_dense_output");

  if (shouldRepairStructure) {
    repaired = applyHeadingAndListStrategy(repaired, plan);
  }

  const shouldRepairDensity =
    issues.includes("excess_one_sentence_paragraphs") ||
    issues.includes("excess_short_paragraphs_for_dense_output") ||
    issues.includes("weak_paragraph_density");

  if (shouldRepairDensity) {
    repaired = repairParagraphDensity(repaired, plan);
  }

  repaired = normalizeSpacing(repaired);
  return repaired;
}

function runRepairLoop(text: string, plan: ResponseLayoutPlan): string {
  let current = normalizeSpacing(text);
  let iterations = 0;

  while (iterations < 3) {
    const issues = collectCoreIssues(current, plan);
    if (!issues.length) break;

    const repaired = repairCoreStructure(current, plan, issues);
    if (repaired === current) break;

    current = repaired;
    iterations += 1;
  }

  return current;
}

function calculatePassScore(
  structureScore: number,
  cohesionScore: number,
  memoryScore: number,
  multiCallScore: number,
  repaired: boolean,
): number {
  const score =
    structureScore * 0.32 +
    cohesionScore * 0.34 +
    memoryScore * 0.17 +
    multiCallScore * 0.17 +
    (repaired ? 0.02 : 0);

  return Math.max(0.78, Math.min(0.99, Number(score.toFixed(4))));
}

function calculateFailScore(
  issueCount: number,
  structureScore: number,
  cohesionScore: number,
  memoryScore: number,
  multiCallScore: number,
): number {
  const score =
    0.84 -
    issueCount * 0.075 +
    structureScore * 0.08 +
    cohesionScore * 0.08 +
    memoryScore * 0.04 +
    multiCallScore * 0.04;

  return Math.max(0.18, Math.min(0.93, Number(score.toFixed(4))));
}

export function textualOutputAuditor(
  text: string,
  plan: ResponseLayoutPlan,
  context?: TextualAuditContext,
): TextualAudit {
  const source = `${text || ""}`.trim();
  let repaired = runRepairLoop(source, plan);

  let antiFragmentation = runAntiFragmentationGate(repaired, plan);
  if (antiFragmentation.triggered) {
    repaired = normalizeSpacing(antiFragmentation.repairedText);
  }

  let antiMonoblock = runAntiMonoblockGate(repaired, plan);
  if (antiMonoblock.triggered) {
    repaired = normalizeSpacing(antiMonoblock.repairedText);
  }

  repaired = runRepairLoop(repaired, plan);
  repaired = normalizeSpacing(repaired);

  const structure = validateParagraphStructure(repaired, plan);
  const cohesion = validateDiscourseCohesion(repaired, plan);
  const memory = validateLongFormMemoryConsumption(repaired, context);
  const multiCall = validateMultiCallContinuity(repaired, context);

  const structureScore = getValidationScore(structure);
  const cohesionScore = getValidationScore(cohesion);
  const memoryScore = getValidationScore(memory);
  const multiCallScore = getValidationScore(multiCall);

  const finalIssues = Array.from(
    new Set([
      ...collectCoreIssues(repaired, plan),
      ...getValidationIssues(antiFragmentation),
      ...getValidationIssues(antiMonoblock),
      ...getValidationIssues(structure),
      ...getValidationIssues(cohesion),
      ...getValidationIssues(memory),
      ...getValidationIssues(multiCall),
    ]),
  );

  const wasRepaired = repaired !== source;

  if (finalIssues.length === 0) {
    return {
      passed: true,
      score: calculatePassScore(
        structureScore,
        cohesionScore,
        memoryScore,
        multiCallScore,
        wasRepaired,
      ),
      issues: [],
      repairedText: wasRepaired ? repaired : undefined,
    };
  }

  return {
    passed: false,
    score: calculateFailScore(
      finalIssues.length,
      structureScore,
      cohesionScore,
      memoryScore,
      multiCallScore,
    ),
    issues: finalIssues,
    repairedText: wasRepaired ? repaired : undefined,
  };
}