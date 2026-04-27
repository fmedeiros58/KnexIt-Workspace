import type {
  CouncilAdvisorReport,
  CouncilRiskLevel,
  CouncilScoringState,
  DisagreementResolutionResult,
  RevisionPriority,
  RevisionPriorityResult,
} from "../council-types";

type RevisionSeverity = RevisionPriority["severity"];
type RevisionRecommendedAction = RevisionPriority["recommendedAction"];

interface PriorityCandidate {
  readonly issue: string;
  readonly sourceAdvisor: string;
  readonly advisorName?: string;
  readonly advisorRisk?: CouncilRiskLevel;
  readonly severity: RevisionSeverity;
  readonly priority: number;
  readonly reason: string;
  readonly recommendedAction: RevisionRecommendedAction;
}

interface IssueClassification {
  readonly severity: RevisionSeverity;
  readonly basePriority: number;
  readonly recommendedAction: RevisionRecommendedAction;
  readonly reasonHint: string;
}

interface ScoreLike {
  readonly level?: unknown;
  readonly risk?: unknown;
  readonly score?: unknown;
  readonly reasons?: unknown;
  readonly notes?: unknown;
}

const SEVERITY_PRIORITY: Record<RevisionSeverity, number> = {
  critical: 100,
  high: 80,
  medium: 55,
  low: 25,
};

const RISK_WEIGHT: Record<CouncilRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const ADVISOR_PRIORITY_WEIGHT: Record<string, number> = {
  logical: 14,
  evidence: 12,
  completeness: 12,
  anti_sycophancy: 10,
  skeptical: 9,
  user_interest: 9,
  communication: 5,
  synthesis: 10,
  scoring: 10,
};

const BLOCK_PATTERNS = [
  "block_delivery",
  "delivery_blocked",
  "unresolved_contradictions",
  "critical_logic",
  "critical_completeness",
  "violated_constraints",
  "violated constraint",
  "contradiction",
  "contradicao",
  "contradição",
  "safety",
  "policy_violation",
  "cannot_deliver",
];

const REGENERATE_PATTERNS = [
  "closure_failed",
  "reasoning_closure_failed",
  "failed_closure",
  "unsupported_conclusions",
  "incomplete_case_analysis",
  "unresolved_scenarios",
  "missing_variables",
  "missing_obligations",
  "answer_integrity_critical",
  "critical_depth_insufficient",
  "regenerate",
  "rebuild",
  "core_reasoning_failure",
];

const HIGH_REVISION_PATTERNS = [
  "unconditional_agreement",
  "sycophancy",
  "over_agreement",
  "premise_accepted_without_testing",
  "premise_not_tested",
  "opinion_treated_as_truth",
  "user_opinion_as_truth",
  "unsupported",
  "without_support",
  "source_marker_without_source",
  "citation_requested_but_missing",
  "high_confidence",
  "confidence",
  "evidence_inference",
  "language_shift",
  "aggressive_tone",
  "requested_format_not_satisfied",
  "missing_explicit_conclusion",
  "decision_request_without_recommendation",
  "missing_actionable_next_steps",
];

const MEDIUM_REVISION_PATTERNS = [
  "counterpoint",
  "weakness",
  "low_objectivity",
  "caveat",
  "uncertainty",
  "generic_praise",
  "surface_level",
  "tone",
  "communication",
  "format",
  "clarity",
  "repetition",
];

export function rankRevisionPriorities(
  advisorReports: CouncilAdvisorReport[],
  scores: CouncilScoringState,
  disagreementResolution: DisagreementResolutionResult,
): RevisionPriorityResult {
  const candidates = dedupePriorities([
    ...prioritiesFromAdvisorReports(advisorReports),
    ...prioritiesFromScores(scores),
    ...prioritiesFromDisagreements(disagreementResolution),
    ...prioritiesFromDominantConcerns(disagreementResolution),
  ]);

  const sorted = candidates.sort(comparePriorities);
  const topIssues = sorted.slice(0, 8);

  const mustBlock = topIssues.some(
    (issue) => issue.recommendedAction === "block",
  );

  const mustRegenerate =
    !mustBlock &&
    topIssues.some(
      (issue) =>
        issue.recommendedAction === "regenerate" ||
        isCoreCriticalIssue(issue),
    );

  const mustRevise =
    !mustBlock &&
    !mustRegenerate &&
    topIssues.some((issue) => issue.recommendedAction === "revise");

  return {
    priorities: sorted,
    topIssues,
    mustRevise,
    mustRegenerate,
    mustBlock,
  };
}

function prioritiesFromAdvisorReports(
  advisorReports: readonly CouncilAdvisorReport[] | undefined,
): RevisionPriority[] {
  const reports = Array.isArray(advisorReports) ? advisorReports : [];
  const priorities: RevisionPriority[] = [];

  for (const report of reports) {
    const advisorId = String(report.advisorId ?? "unknown_advisor");
    const advisorName = String(report.advisorName ?? advisorId);
    const advisorRisk = normalizeRisk(report.risk);

    for (const concern of report.concerns ?? []) {
      priorities.push(
        buildPriority({
          issue: concern,
          sourceAdvisor: advisorId,
          advisorName,
          advisorRisk,
          origin: "concern",
        }),
      );
    }

    for (const revision of report.requiredRevisions ?? []) {
      priorities.push(
        buildPriority({
          issue: revision,
          sourceAdvisor: advisorId,
          advisorName,
          advisorRisk,
          origin: "required_revision",
        }),
      );
    }

    for (const unsupportedClaim of report.unsupportedClaims ?? []) {
      priorities.push(
        buildPriority({
          issue: `unsupported_claim:${unsupportedClaim}`,
          sourceAdvisor: advisorId,
          advisorName,
          advisorRisk: maxRisk(advisorRisk, "medium"),
          origin: "unsupported_claim",
        }),
      );
    }

    for (const contradiction of report.contradictions ?? []) {
      priorities.push(
        buildPriority({
          issue: `contradiction:${contradiction}`,
          sourceAdvisor: advisorId,
          advisorName,
          advisorRisk: maxRisk(advisorRisk, "high"),
          origin: "contradiction",
        }),
      );
    }

    for (const counterpoint of report.missingCounterpoints ?? []) {
      priorities.push(
        buildPriority({
          issue: `missing_counterpoint:${counterpoint}`,
          sourceAdvisor: advisorId,
          advisorName,
          advisorRisk: maxRisk(advisorRisk, "medium"),
          origin: "missing_counterpoint",
        }),
      );
    }

    for (const signal of report.overAgreementSignals ?? []) {
      priorities.push(
        buildPriority({
          issue: `over_agreement:${signal}`,
          sourceAdvisor: advisorId,
          advisorName,
          advisorRisk: maxRisk(advisorRisk, "medium"),
          origin: "over_agreement",
        }),
      );
    }
  }

  return priorities;
}

function prioritiesFromScores(scores: CouncilScoringState): RevisionPriority[] {
  const priorities: RevisionPriority[] = [];

  const scoreDefinitions: Array<{
    readonly key: string;
    readonly issue: string;
    readonly highReason: string;
    readonly criticalReason: string;
    readonly mediumReason: string;
  }> = [
    {
      key: "answerIntegrity",
      issue: "answer_integrity",
      criticalReason:
        "Overall answer integrity score indicates critical response fragility.",
      highReason:
        "Answer integrity score indicates serious structural fragility.",
      mediumReason:
        "Answer integrity score indicates moderate quality or consistency risk.",
    },
    {
      key: "criticalDepth",
      issue: "critical_depth",
      criticalReason:
        "Critical depth scorer indicates critically shallow or agreement-biased analysis.",
      highReason:
        "Critical depth scorer indicates insufficient premise testing or counterpoint.",
      mediumReason:
        "Critical depth scorer indicates moderate need for stronger critique.",
    },
    {
      key: "confidenceCalibration",
      issue: "confidence_calibration",
      criticalReason:
        "Confidence calibration score indicates critically mismatched certainty.",
      highReason:
        "Confidence calibration score indicates overconfidence or underconfidence.",
      mediumReason:
        "Confidence calibration score indicates confidence should be adjusted.",
    },
    {
      key: "userBenefit",
      issue: "user_benefit",
      criticalReason:
        "User-benefit score indicates the answer may fail the user's real-world interest.",
      highReason:
        "User-benefit score indicates missing practical value or user protection.",
      mediumReason:
        "User-benefit score indicates practical usefulness should be improved.",
    },
    {
      key: "sycophancy",
      issue: "sycophancy",
      criticalReason:
        "Sycophancy score indicates critical over-agreement or user-pleasing behavior.",
      highReason:
        "Sycophancy score indicates the answer should be revised for epistemic independence.",
      mediumReason:
        "Sycophancy score indicates moderate risk of over-validation.",
    },
    {
      key: "evidence",
      issue: "evidence_grounding",
      criticalReason:
        "Evidence score indicates critical unsupported or misgrounded claims.",
      highReason:
        "Evidence score indicates unsupported claims or weak grounding.",
      mediumReason:
        "Evidence score indicates caveats or support clarification are needed.",
    },
    {
      key: "completeness",
      issue: "completeness",
      criticalReason:
        "Completeness score indicates critical missing obligations or closure failure.",
      highReason:
        "Completeness score indicates major missing variables, obligations or scenarios.",
      mediumReason:
        "Completeness score indicates incomplete coverage that should be revised.",
    },
  ];

  for (const definition of scoreDefinitions) {
    const score = getScore(scores, definition.key);
    const level = normalizeRisk(score.level ?? score.risk);

    if (level === "low") {
      continue;
    }

    const reasons = toStringArray(score.reasons).concat(toStringArray(score.notes));
    const scoreValue = typeof score.score === "number" ? score.score : null;
    const issue = `${definition.issue}_${level}`;

    const severity = riskToSeverity(level);
    const recommendedAction = actionForScoreIssue(definition.key, level);

    priorities.push({
      issue,
      sourceAdvisor: "scoring",
      severity,
      priority: scorePriority({
        issue,
        severity,
        sourceAdvisor: "scoring",
        advisorRisk: level,
        score: scoreValue,
      }),
      reason:
        level === "critical"
          ? appendScoreReasons(definition.criticalReason, reasons)
          : level === "high"
            ? appendScoreReasons(definition.highReason, reasons)
            : appendScoreReasons(definition.mediumReason, reasons),
      recommendedAction,
    });
  }

  return priorities;
}

function prioritiesFromDisagreements(
  disagreementResolution: DisagreementResolutionResult,
): RevisionPriority[] {
  const priorities: RevisionPriority[] = [];
  const disagreements = getArrayProperty(disagreementResolution, "disagreements");

  for (const item of disagreements) {
    if (!isRecord(item)) {
      continue;
    }

    const topic = getString(item.topic) || "unknown_disagreement";
    const priority = normalizeText(getString(item.priority));
    const severity: RevisionSeverity =
      priority === "critical" ? "critical" : priority === "high" ? "high" : "medium";

    if (severity === "medium") {
      continue;
    }

    const issue = `resolved_conflict:${topic}`;
    const recommendedAction: RevisionRecommendedAction =
      severity === "critical" ? "regenerate" : "revise";

    priorities.push({
      issue,
      sourceAdvisor: "synthesis",
      severity,
      priority: scorePriority({
        issue,
        severity,
        sourceAdvisor: "synthesis",
        advisorRisk: severity,
        score: null,
      }),
      reason:
        getString(item.reason) ||
        "Council disagreement requires resolution before final approval.",
      recommendedAction,
    });
  }

  return priorities;
}

function prioritiesFromDominantConcerns(
  disagreementResolution: DisagreementResolutionResult,
): RevisionPriority[] {
  const dominantConcerns = getStringArrayProperty(
    disagreementResolution,
    "dominantConcerns",
  );

  return dominantConcerns.map((concern) => {
    const classification = classifyIssue(concern);
    const severity =
      classification.severity === "low" ? "medium" : classification.severity;

    return {
      issue: `dominant_concern:${concern}`,
      sourceAdvisor: "synthesis",
      severity,
      priority: scorePriority({
        issue: concern,
        severity,
        sourceAdvisor: "synthesis",
        advisorRisk: severity,
        score: null,
      }),
      reason:
        "Dominant Council concern selected during disagreement resolution.",
      recommendedAction:
        classification.recommendedAction === "ignore"
          ? "revise"
          : classification.recommendedAction,
    };
  });
}

function buildPriority(input: {
  readonly issue: string;
  readonly sourceAdvisor: string;
  readonly advisorName: string;
  readonly advisorRisk: CouncilRiskLevel;
  readonly origin: string;
}): RevisionPriority {
  const classification = classifyIssue(input.issue);
  const severity = maxSeverity(
    classification.severity,
    riskToSeverity(input.advisorRisk),
  );

  const recommendedAction = chooseRecommendedAction({
    issue: input.issue,
    severity,
    classifiedAction: classification.recommendedAction,
    advisorRisk: input.advisorRisk,
  });

  return {
    issue: input.issue,
    sourceAdvisor: input.sourceAdvisor,
    severity,
    priority: scorePriority({
      issue: input.issue,
      severity,
      sourceAdvisor: input.sourceAdvisor,
      advisorRisk: input.advisorRisk,
      score: null,
    }),
    reason: buildReason({
      advisorName: input.advisorName,
      advisorRisk: input.advisorRisk,
      origin: input.origin,
      hint: classification.reasonHint,
    }),
    recommendedAction,
  };
}

function classifyIssue(issue: string): IssueClassification {
  const normalized = normalizeText(issue);

  if (includesAny(normalized, BLOCK_PATTERNS)) {
    return {
      severity: "critical",
      basePriority: 100,
      recommendedAction: "block",
      reasonHint:
        "Issue can invalidate delivery because it affects contradiction, constraints, closure or blocking safety.",
    };
  }

  if (includesAny(normalized, REGENERATE_PATTERNS)) {
    return {
      severity: "critical",
      basePriority: 92,
      recommendedAction: "regenerate",
      reasonHint:
        "Issue affects core reasoning, completion or structural integrity and may require rebuilding.",
    };
  }

  if (includesAny(normalized, HIGH_REVISION_PATTERNS)) {
    return {
      severity: "high",
      basePriority: 80,
      recommendedAction: "revise",
      reasonHint:
        "Issue requires revision before approval because it affects correctness, grounding or independence.",
    };
  }

  if (includesAny(normalized, MEDIUM_REVISION_PATTERNS)) {
    return {
      severity: "medium",
      basePriority: 55,
      recommendedAction: "revise",
      reasonHint:
        "Issue requires targeted improvement but is not necessarily blocking.",
    };
  }

  return {
    severity: "low",
    basePriority: 25,
    recommendedAction: "ignore",
    reasonHint:
      "Issue is low priority unless reinforced by advisor risk or scoring signals.",
  };
}

function chooseRecommendedAction(input: {
  readonly issue: string;
  readonly severity: RevisionSeverity;
  readonly classifiedAction: RevisionRecommendedAction;
  readonly advisorRisk: CouncilRiskLevel;
}): RevisionRecommendedAction {
  if (input.classifiedAction === "block") {
    return "block";
  }

  if (input.classifiedAction === "regenerate") {
    return "regenerate";
  }

  if (
    input.severity === "critical" &&
    includesAny(input.issue, [
      "contradiction",
      "contradicao",
      "contradição",
      "violated_constraints",
      "block",
    ])
  ) {
    return "block";
  }

  if (
    input.severity === "critical" ||
    input.advisorRisk === "critical"
  ) {
    return "regenerate";
  }

  if (input.severity === "high" || input.advisorRisk === "high") {
    return "revise";
  }

  if (input.severity === "medium") {
    return "revise";
  }

  return "ignore";
}

function actionForScoreIssue(
  scoreKey: string,
  level: CouncilRiskLevel,
): RevisionRecommendedAction {
  if (level === "critical") {
    if (scoreKey === "answerIntegrity" || scoreKey === "completeness") {
      return "block";
    }

    if (scoreKey === "criticalDepth" || scoreKey === "evidence") {
      return "regenerate";
    }

    return "revise";
  }

  if (level === "high") {
    if (scoreKey === "answerIntegrity" || scoreKey === "completeness") {
      return "regenerate";
    }

    return "revise";
  }

  if (level === "medium") {
    return "revise";
  }

  return "ignore";
}

function scorePriority(input: {
  readonly issue: string;
  readonly severity: RevisionSeverity;
  readonly sourceAdvisor: string;
  readonly advisorRisk: CouncilRiskLevel | RevisionSeverity;
  readonly score: number | null;
}): number {
  const base = SEVERITY_PRIORITY[input.severity] ?? 25;
  const advisorWeight = ADVISOR_PRIORITY_WEIGHT[input.sourceAdvisor] ?? 4;
  const riskBonus = riskToNumber(input.advisorRisk) * 4;
  const scoreBonus =
    typeof input.score === "number" && Number.isFinite(input.score)
      ? Math.round(clamp(input.score, 0, 1) * 8)
      : 0;

  const issueBonus = includesAny(input.issue, [
    "contradiction",
    "contradicao",
    "contradição",
    "violated_constraints",
    "closure",
    "unsupported",
    "completeness",
    "answer_integrity",
  ])
    ? 6
    : 0;

  return clampInteger(base + advisorWeight + riskBonus + scoreBonus + issueBonus, 0, 120);
}

function buildReason(input: {
  readonly advisorName: string;
  readonly advisorRisk: CouncilRiskLevel;
  readonly origin: string;
  readonly hint: string;
}): string {
  return `${input.hint} Reported by ${input.advisorName} as ${input.origin} with risk ${input.advisorRisk}.`;
}

function appendScoreReasons(baseReason: string, reasons: readonly string[]): string {
  const visibleReasons = dedupe(reasons).slice(0, 4);

  if (visibleReasons.length === 0) {
    return baseReason;
  }

  return `${baseReason} Signals: ${visibleReasons.join(" | ")}.`;
}

function dedupePriorities(
  priorities: readonly RevisionPriority[],
): RevisionPriority[] {
  const byKey = new Map<string, RevisionPriority>();

  for (const item of priorities) {
    const key = `${normalizeText(item.sourceAdvisor)}:${normalizeIssueKey(item.issue)}`;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, item);
      continue;
    }

    byKey.set(key, mergePriority(existing, item));
  }

  return Array.from(byKey.values());
}

function mergePriority(
  left: RevisionPriority,
  right: RevisionPriority,
): RevisionPriority {
  const dominant = right.priority > left.priority ? right : left;
  const secondary = dominant === right ? left : right;

  return {
    ...dominant,
    severity: maxSeverity(left.severity, right.severity),
    priority: Math.max(left.priority, right.priority),
    reason: dedupe([dominant.reason, secondary.reason]).join(" "),
    recommendedAction: moreSevereAction(
      left.recommendedAction,
      right.recommendedAction,
    ),
  };
}

function comparePriorities(
  left: RevisionPriority,
  right: RevisionPriority,
): number {
  if (right.priority !== left.priority) {
    return right.priority - left.priority;
  }

  const severityDelta =
    SEVERITY_PRIORITY[right.severity] - SEVERITY_PRIORITY[left.severity];

  if (severityDelta !== 0) {
    return severityDelta;
  }

  return actionPriority(right.recommendedAction) -
    actionPriority(left.recommendedAction);
}

function isCoreCriticalIssue(issue: RevisionPriority): boolean {
  if (issue.severity !== "critical") {
    return false;
  }

  return includesAny(issue.issue, [
    "closure",
    "reasoning",
    "completeness",
    "answer_integrity",
    "critical_depth",
    "unsupported_conclusions",
    "unresolved_scenarios",
  ]);
}

function moreSevereAction(
  left: RevisionRecommendedAction,
  right: RevisionRecommendedAction,
): RevisionRecommendedAction {
  return actionPriority(left) >= actionPriority(right) ? left : right;
}

function actionPriority(action: RevisionRecommendedAction): number {
  switch (action) {
    case "block":
      return 4;
    case "regenerate":
      return 3;
    case "revise":
      return 2;
    case "ignore":
    default:
      return 0;
  }
}

function riskToSeverity(risk: CouncilRiskLevel): RevisionSeverity {
  if (risk === "critical") return "critical";
  if (risk === "high") return "high";
  if (risk === "medium") return "medium";
  return "low";
}

function maxSeverity(
  left: RevisionSeverity,
  right: RevisionSeverity,
): RevisionSeverity {
  return SEVERITY_PRIORITY[left] >= SEVERITY_PRIORITY[right] ? left : right;
}

function maxRisk(
  left: CouncilRiskLevel,
  right: CouncilRiskLevel,
): CouncilRiskLevel {
  return RISK_WEIGHT[left] >= RISK_WEIGHT[right] ? left : right;
}

function normalizeRisk(value: unknown): CouncilRiskLevel {
  const normalized = normalizeText(String(value ?? ""));

  if (
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high" ||
    normalized === "critical"
  ) {
    return normalized;
  }

  return "low";
}

function riskToNumber(value: CouncilRiskLevel | RevisionSeverity): number {
  if (value === "critical") return 3;
  if (value === "high") return 2;
  if (value === "medium") return 1;
  return 0;
}

function getScore(scores: CouncilScoringState, key: string): ScoreLike {
  if (!isRecord(scores)) {
    return {};
  }

  const value = scores[key];

  return isRecord(value) ? (value as ScoreLike) : {};
}

function getArrayProperty(source: unknown, key: string): unknown[] {
  if (!isRecord(source)) {
    return [];
  }

  const value = source[key];

  return Array.isArray(value) ? value : [];
}

function getStringArrayProperty(source: unknown, key: string): string[] {
  if (!isRecord(source)) {
    return [];
  }

  const value = source[key];

  return toStringArray(value);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return dedupe(
    value
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean),
  );
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function includesAny(text: string, fragments: readonly string[]): boolean {
  const normalized = normalizeText(text);

  return fragments.some((fragment) =>
    normalized.includes(normalizeText(fragment)),
  );
}

function normalizeIssueKey(issue: string): string {
  return normalizeText(issue)
    .replace(/\d+/g, "#")
    .replace(/["'`]/g, "")
    .slice(0, 180);
}

function normalizeText(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

function clampInteger(value: number, min: number, max: number): number {
  return Math.trunc(Math.min(Math.max(value, min), max));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}