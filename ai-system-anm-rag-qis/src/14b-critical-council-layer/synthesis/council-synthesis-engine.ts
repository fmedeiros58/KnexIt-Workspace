import type {
  CouncilAdvisorReport,
  CouncilScoringState,
  CouncilSynthesisResult,
} from "../council-types";
import { resolveCouncilDisagreements } from "./disagreement-resolver";
import { rankRevisionPriorities } from "./revision-priority-ranker";
import { buildFinalRecommendation } from "./final-recommendation-builder";

interface CouncilSynthesisInput {
  readonly advisorReports: CouncilAdvisorReport[];
  readonly scores: CouncilScoringState;
  readonly reasoningClosurePassed: boolean;
  readonly unresolvedFrom14a: boolean;
  readonly loopExhausted: boolean;
}

interface SynthesisSummaryInput {
  readonly advisorReports: readonly CouncilAdvisorReport[];
  readonly disagreementResolution: ReturnType<typeof resolveCouncilDisagreements>;
  readonly revisionPriority: ReturnType<typeof rankRevisionPriorities>;
  readonly finalRecommendation: ReturnType<typeof buildFinalRecommendation>;
  readonly reasoningClosurePassed: boolean;
  readonly unresolvedFrom14a: boolean;
  readonly loopExhausted: boolean;
}

export function runCouncilSynthesis(
  input: CouncilSynthesisInput,
): CouncilSynthesisResult {
  const advisorReports = normalizeAdvisorReports(input.advisorReports);

  const disagreementResolution = resolveCouncilDisagreements(
    advisorReports,
    input.scores,
  );

  const revisionPriority = rankRevisionPriorities(
    advisorReports,
    input.scores,
    disagreementResolution,
  );

  const finalRecommendation = buildFinalRecommendation({
    advisorReports,
    scores: input.scores,
    disagreementResolution,
    revisionPriority,
    reasoningClosurePassed: Boolean(input.reasoningClosurePassed),
    unresolvedFrom14a: Boolean(input.unresolvedFrom14a),
    loopExhausted: Boolean(input.loopExhausted),
  });

  const synthesisSummary = buildSynthesisSummary({
    advisorReports,
    disagreementResolution,
    revisionPriority,
    finalRecommendation,
    reasoningClosurePassed: Boolean(input.reasoningClosurePassed),
    unresolvedFrom14a: Boolean(input.unresolvedFrom14a),
    loopExhausted: Boolean(input.loopExhausted),
  });

  return {
    disagreementResolution,
    revisionPriority,
    finalRecommendation,
    synthesisSummary,
  };
}

function normalizeAdvisorReports(
  advisorReports: readonly CouncilAdvisorReport[] | undefined,
): CouncilAdvisorReport[] {
  if (!Array.isArray(advisorReports)) {
    return [];
  }

  return advisorReports.filter(Boolean);
}

function buildSynthesisSummary(input: SynthesisSummaryInput): string {
  const advisorStats = getAdvisorStats(input.advisorReports);
  const topIssuesCount = getArrayLength(input.revisionPriority, "topIssues");
  const prioritiesCount = getArrayLength(input.revisionPriority, "priorities");
  const disagreementsCount = getArrayLength(
    input.disagreementResolution,
    "disagreements",
  );

  const action = getStringProperty(input.finalRecommendation, "action", "revise");
  const confidence = getNumberProperty(input.finalRecommendation, "confidence");
  const deliveryBlocked = getBooleanProperty(
    input.finalRecommendation,
    "deliveryBlocked",
  );

  const summaryParts = [
    `action=${action}`,
    `confidence=${formatConfidence(confidence)}`,
    `deliveryBlocked=${deliveryBlocked}`,
    `advisorReports=${advisorStats.total}`,
    `failedAdvisors=${advisorStats.failed}`,
    `criticalAdvisors=${advisorStats.critical}`,
    `highRiskAdvisors=${advisorStats.high}`,
    `topIssues=${topIssuesCount}`,
    `priorities=${prioritiesCount}`,
    `disagreements=${disagreementsCount}`,
    `reasoningClosurePassed=${input.reasoningClosurePassed}`,
    `unresolvedFrom14a=${input.unresolvedFrom14a}`,
    `loopExhausted=${input.loopExhausted}`,
  ];

  const dominantConcerns = getDominantConcerns(input.advisorReports);

  if (dominantConcerns.length > 0) {
    summaryParts.push(`dominantConcerns=${dominantConcerns.join("|")}`);
  }

  return summaryParts.join("; ");
}

function getAdvisorStats(advisorReports: readonly CouncilAdvisorReport[]): {
  readonly total: number;
  readonly failed: number;
  readonly critical: number;
  readonly high: number;
} {
  return {
    total: advisorReports.length,
    failed: advisorReports.filter((report) => !report.passed).length,
    critical: advisorReports.filter((report) => report.risk === "critical")
      .length,
    high: advisorReports.filter((report) => report.risk === "high").length,
  };
}

function getDominantConcerns(
  advisorReports: readonly CouncilAdvisorReport[],
): string[] {
  const concerns = advisorReports
    .filter((report) => report.risk === "critical" || report.risk === "high")
    .flatMap((report) => report.concerns ?? [])
    .map((concern) => String(concern ?? "").trim())
    .filter(Boolean);

  return dedupe(concerns).slice(0, 6);
}

function getArrayLength(source: unknown, key: string): number {
  if (!isRecord(source)) {
    return 0;
  }

  const value = source[key];

  return Array.isArray(value) ? value.length : 0;
}

function getStringProperty(
  source: unknown,
  key: string,
  fallback = "",
): string {
  if (!isRecord(source)) {
    return fallback;
  }

  const value = source[key];

  return typeof value === "string" && value.trim() ? value : fallback;
}

function getNumberProperty(source: unknown, key: string): number | null {
  if (!isRecord(source)) {
    return null;
  }

  const value = source[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getBooleanProperty(source: unknown, key: string): boolean {
  if (!isRecord(source)) {
    return false;
  }

  return source[key] === true;
}

function formatConfidence(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "unknown";
  }

  return String(Math.round(value * 1000) / 1000);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}