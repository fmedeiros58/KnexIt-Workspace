import type { CouncilRiskLevel } from "../council-types";

export interface CompletenessRiskInput {
  readonly missingVariables?: readonly string[];
  readonly missingObligations?: readonly string[];
  readonly unresolvedScenarios?: readonly string[];
  readonly violatedConstraints?: readonly string[];
  readonly unsupportedConclusions?: readonly string[];
  readonly missingFormats?: readonly string[];
  readonly closurePassed?: boolean | null;
  readonly completionScore?: number | null;
}

export interface CompletenessRiskResult {
  readonly risk: CouncilRiskLevel;
  readonly score: number;
  readonly concerns: string[];
}

interface CompletenessConcernRule {
  readonly id: string;
  readonly label: string;
  readonly values: readonly string[];
  readonly weightPerItem: number;
  readonly maxContribution: number;
  readonly minimumRisk?: CouncilRiskLevel;
}

const RISK_WEIGHT: Record<CouncilRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function scoreCompletenessRisk(
  input: CompletenessRiskInput,
): CompletenessRiskResult {
  const normalizedInput = normalizeInput(input);
  const concerns: string[] = [];

  const rules: CompletenessConcernRule[] = [
    {
      id: "missing_variables",
      label: "Missing variables",
      values: normalizedInput.missingVariables,
      weightPerItem: 0.18,
      maxContribution: 0.5,
      minimumRisk: "medium",
    },
    {
      id: "missing_obligations",
      label: "Missing obligations",
      values: normalizedInput.missingObligations,
      weightPerItem: 0.16,
      maxContribution: 0.45,
      minimumRisk: "medium",
    },
    {
      id: "unresolved_scenarios",
      label: "Unresolved scenarios",
      values: normalizedInput.unresolvedScenarios,
      weightPerItem: 0.18,
      maxContribution: 0.42,
      minimumRisk: "medium",
    },
    {
      id: "violated_constraints",
      label: "Violated constraints",
      values: normalizedInput.violatedConstraints,
      weightPerItem: 0.26,
      maxContribution: 0.65,
      minimumRisk: "high",
    },
    {
      id: "unsupported_conclusions",
      label: "Unsupported conclusions",
      values: normalizedInput.unsupportedConclusions,
      weightPerItem: 0.22,
      maxContribution: 0.55,
      minimumRisk: "high",
    },
    {
      id: "missing_formats",
      label: "Missing requested formats",
      values: normalizedInput.missingFormats,
      weightPerItem: 0.14,
      maxContribution: 0.35,
      minimumRisk: "medium",
    },
  ];

  let score = 0;
  let minimumRisk: CouncilRiskLevel = "low";

  for (const rule of rules) {
    if (rule.values.length === 0) {
      continue;
    }

    const contribution = Math.min(
      rule.maxContribution,
      rule.values.length * rule.weightPerItem,
    );

    score += contribution;
    concerns.push(formatConcern(rule.label, rule.values));

    if (rule.minimumRisk) {
      minimumRisk = maxRisk(minimumRisk, rule.minimumRisk);
    }
  }

  if (normalizedInput.closurePassed === false) {
    score += 0.28;
    minimumRisk = maxRisk(minimumRisk, "high");
    concerns.push("Reasoning closure failed");
  }

  if (
    typeof normalizedInput.completionScore === "number" &&
    normalizedInput.completionScore < 0.72
  ) {
    const completionPenalty = Math.min(
      0.35,
      Math.max(0, 0.72 - normalizedInput.completionScore),
    );

    score += completionPenalty;
    minimumRisk = maxRisk(
      minimumRisk,
      normalizedInput.completionScore < 0.5 ? "high" : "medium",
    );
    concerns.push(
      `Low completion score: ${round(normalizedInput.completionScore, 3)}`,
    );
  }

  const finalScore = round(clamp(score, 0, 1), 3);
  const scoreRisk = riskFromScore(finalScore);
  const risk = maxRisk(scoreRisk, minimumRisk);

  return {
    risk,
    score: finalScore,
    concerns: dedupe(concerns),
  };
}

function normalizeInput(input: CompletenessRiskInput): Required<CompletenessRiskInput> {
  return {
    missingVariables: dedupe(input.missingVariables ?? []),
    missingObligations: dedupe(input.missingObligations ?? []),
    unresolvedScenarios: dedupe(input.unresolvedScenarios ?? []),
    violatedConstraints: dedupe(input.violatedConstraints ?? []),
    unsupportedConclusions: dedupe(input.unsupportedConclusions ?? []),
    missingFormats: dedupe(input.missingFormats ?? []),
    closurePassed:
      typeof input.closurePassed === "boolean" ? input.closurePassed : null,
    completionScore:
      typeof input.completionScore === "number" &&
      Number.isFinite(input.completionScore)
        ? clamp(input.completionScore, 0, 1)
        : null,
  };
}

function riskFromScore(score: number): CouncilRiskLevel {
  if (score >= 0.86) return "critical";
  if (score >= 0.68) return "high";
  if (score >= 0.35) return "medium";
  return "low";
}

function maxRisk(
  left: CouncilRiskLevel,
  right: CouncilRiskLevel,
): CouncilRiskLevel {
  return RISK_WEIGHT[left] >= RISK_WEIGHT[right] ? left : right;
}

function formatConcern(label: string, values: readonly string[]): string {
  const visibleValues = values.slice(0, 8);
  const suffix =
    values.length > visibleValues.length
      ? ` (+${values.length - visibleValues.length} more)`
      : "";

  return `${label}: ${visibleValues.join(" | ")}${suffix}`;
}

function dedupe(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = String(value ?? "").trim();
    const key = normalizeText(cleaned);

    if (!cleaned || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function normalizeText(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, decimals = 3): number {
  const factor = 10 ** Math.max(0, Math.floor(decimals));

  return Math.round(value * factor) / factor;
}