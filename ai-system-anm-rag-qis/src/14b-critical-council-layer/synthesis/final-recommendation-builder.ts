import type {
  CouncilAction,
  CouncilAdvisorReport,
  CouncilFinalRecommendation,
  CouncilRiskLevel,
  CouncilScoringState,
  DisagreementResolutionResult,
  RevisionPriorityResult,
} from "../council-types";

interface FinalRecommendationInput {
  readonly advisorReports: CouncilAdvisorReport[];
  readonly scores: CouncilScoringState;
  readonly disagreementResolution: DisagreementResolutionResult;
  readonly revisionPriority: RevisionPriorityResult;
  readonly reasoningClosurePassed: boolean;
  readonly unresolvedFrom14a: boolean;
  readonly loopExhausted: boolean;
}

interface RecommendationSignals {
  readonly contradictions: string[];
  readonly unsupportedClaims: string[];
  readonly missingCounterpoints: string[];
  readonly overAgreementSignals: string[];
  readonly requiredRevisions: string[];
  readonly optionalRevisions: string[];
  readonly failedAdvisorIds: string[];
  readonly criticalAdvisorIds: string[];
  readonly highAdvisorIds: string[];
  readonly criticalDisagreements: number;
  readonly highDisagreements: number;
  readonly topIssueCount: number;
  readonly mustBlock: boolean;
  readonly mustRegenerate: boolean;
  readonly mustRevise: boolean;
}

interface ScoreSnapshot {
  readonly sycophancy: CouncilRiskLevel;
  readonly evidence: CouncilRiskLevel;
  readonly userBenefit: CouncilRiskLevel;
  readonly confidenceCalibration: CouncilRiskLevel;
  readonly answerIntegrity: CouncilRiskLevel;
  readonly criticalDepth: CouncilRiskLevel;
  readonly completeness: CouncilRiskLevel;
}

const RISK_WEIGHT: Record<CouncilRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const ACTION_PRIORITY: Record<CouncilAction, number> = {
  approve: 0,
  send_with_caveat: 1,
  revise: 2,
  ask_clarification: 3,
  regenerate: 4,
  block_delivery: 5,
};

export function buildFinalRecommendation(
  input: FinalRecommendationInput,
): CouncilFinalRecommendation {
  const reports = normalizeAdvisorReports(input.advisorReports);
  const signals = collectRecommendationSignals({
    ...input,
    advisorReports: reports,
  });
  const scores = collectScoreSnapshot(input.scores);

  const reasons: string[] = [];
  const caveats: string[] = [];

  const initialAction = resolveInitialAction({
    input,
    signals,
    scores,
    reasons,
    caveats,
  });

  const action = applyLoopPolicy({
    action: initialAction,
    loopExhausted: input.loopExhausted,
    signals,
    scores,
    reasons,
  });

  const approved = action === "approve" || action === "send_with_caveat";
  const deliveryBlocked = action === "block_delivery";

  const finalReasons = dedupe(
    reasons.length > 0 ? reasons : ["Council found no blocking issues."],
  );

  return {
    action,
    approved,
    confidence: calculateRecommendationConfidence({
      action,
      signals,
      scores,
      reasoningClosurePassed: input.reasoningClosurePassed,
      unresolvedFrom14a: input.unresolvedFrom14a,
      loopExhausted: input.loopExhausted,
    }),
    reasons: finalReasons,
    requiredRevisions:
      action === "approve" || action === "send_with_caveat"
        ? []
        : dedupe(signals.requiredRevisions),
    optionalRevisions: dedupe(signals.optionalRevisions),
    caveats: dedupe(caveats),
    deliveryBlocked,
    regenerationAllowed:
      !input.loopExhausted &&
      action !== "approve" &&
      action !== "block_delivery",
  };
}

function resolveInitialAction(input: {
  readonly input: FinalRecommendationInput;
  readonly signals: RecommendationSignals;
  readonly scores: ScoreSnapshot;
  readonly reasons: string[];
  readonly caveats: string[];
}): CouncilAction {
  const { input: source, signals, scores, reasons, caveats } = input;

  if (signals.mustBlock) {
    reasons.push("Critical revision priority requires blocking delivery.");
    return "block_delivery";
  }

  if (hasCriticalIntegrityFailure(scores)) {
    reasons.push("Critical answer-integrity or completeness failure prevents delivery.");
    return "block_delivery";
  }

  if (signals.contradictions.length > 0) {
    reasons.push("Unresolved contradictions require regeneration before approval.");
    return "regenerate";
  }

  if (!source.reasoningClosurePassed || source.unresolvedFrom14a) {
    reasons.push("Logical closure from 14a is not complete.");
    return "regenerate";
  }

  if (signals.mustRegenerate) {
    reasons.push("Revision priority indicates regeneration is required.");
    return "regenerate";
  }

  if (isRiskAtLeast(scores.completeness, "high")) {
    reasons.push("High completeness risk requires regeneration or substantial rewrite.");
    return "regenerate";
  }

  if (isRiskAtLeast(scores.answerIntegrity, "high")) {
    reasons.push("High answer-integrity risk requires regeneration or substantial rewrite.");
    return "regenerate";
  }

  if (isRiskAtLeast(scores.sycophancy, "high")) {
    reasons.push("High sycophancy risk requires revision before approval.");
    return "revise";
  }

  if (isRiskAtLeast(scores.userBenefit, "high")) {
    reasons.push("User-benefit score indicates insufficient practical value.");
    return "revise";
  }

  if (isRiskAtLeast(scores.criticalDepth, "high")) {
    reasons.push("Critical-depth score indicates insufficient premise testing or counterpoint.");
    return "revise";
  }

  if (signals.criticalDisagreements > 0) {
    reasons.push("Critical Council disagreement requires revision before approval.");
    return "revise";
  }

  if (signals.mustRevise) {
    reasons.push("Revision priority indicates mandatory revision before approval.");
    return "revise";
  }

  if (signals.requiredRevisions.length > 0) {
    reasons.push("Required advisor revisions remain pending.");
    return "revise";
  }

  if (signals.failedAdvisorIds.length > 0) {
    reasons.push(`Failed advisors require revision: ${signals.failedAdvisorIds.join(", ")}.`);
    return "revise";
  }

  if (signals.overAgreementSignals.length > 0) {
    reasons.push("Over-agreement signals require epistemic correction.");
    return "revise";
  }

  if (signals.missingCounterpoints.length > 0) {
    reasons.push("Missing counterpoints require revision before approval.");
    return "revise";
  }

  if (shouldSendWithCaveat({ signals, scores })) {
    reasons.push("Response may be delivered only with explicit caveats.");
    caveats.push(...buildCaveats(signals, scores));
    return "send_with_caveat";
  }

  reasons.push("Council found no blocking issues.");
  return "approve";
}

function applyLoopPolicy(input: {
  readonly action: CouncilAction;
  readonly loopExhausted: boolean;
  readonly signals: RecommendationSignals;
  readonly scores: ScoreSnapshot;
  readonly reasons: string[];
}): CouncilAction {
  const { action, loopExhausted, signals, scores, reasons } = input;

  if (!loopExhausted) {
    return action;
  }

  if (action === "approve" || action === "send_with_caveat") {
    reasons.push("Council loop exhausted, but current action is deliverable.");
    return action;
  }

  if (
    action === "regenerate" ||
    action === "revise" ||
    signals.requiredRevisions.length > 0 ||
    signals.contradictions.length > 0 ||
    hasCriticalOrHighCoreRisk(scores)
  ) {
    reasons.push("Council revision loop exhausted while unresolved issues remain.");
    return "block_delivery";
  }

  reasons.push("Council loop exhausted; safest remaining action is blocked delivery.");
  return "block_delivery";
}

function shouldSendWithCaveat(input: {
  readonly signals: RecommendationSignals;
  readonly scores: ScoreSnapshot;
}): boolean {
  const { signals, scores } = input;

  if (signals.unsupportedClaims.length > 0) {
    return true;
  }

  if (scores.evidence === "medium") {
    return true;
  }

  if (scores.confidenceCalibration === "medium") {
    return true;
  }

  return false;
}

function buildCaveats(
  signals: RecommendationSignals,
  scores: ScoreSnapshot,
): string[] {
  const caveats: string[] = [];

  if (signals.unsupportedClaims.length > 0) {
    caveats.push(
      "Part of the response depends on claims that need clearer support or should be framed as inference.",
    );
  }

  if (scores.evidence === "medium") {
    caveats.push(
      "Evidence grounding is partial; avoid presenting uncertain claims as settled facts.",
    );
  }

  if (scores.confidenceCalibration === "medium") {
    caveats.push(
      "Confidence language should remain calibrated to the available support.",
    );
  }

  return caveats;
}

function collectRecommendationSignals(
  input: FinalRecommendationInput,
): RecommendationSignals {
  const advisorReports = normalizeAdvisorReports(input.advisorReports);

  const contradictions = dedupe(
    advisorReports.flatMap((report) => report.contradictions ?? []),
  );

  const unsupportedClaims = dedupe(
    advisorReports.flatMap((report) => report.unsupportedClaims ?? []),
  );

  const missingCounterpoints = dedupe(
    advisorReports.flatMap((report) => report.missingCounterpoints ?? []),
  );

  const overAgreementSignals = dedupe(
    advisorReports.flatMap((report) => report.overAgreementSignals ?? []),
  );

  const requiredRevisions = dedupe(
    advisorReports.flatMap((report) => report.requiredRevisions ?? []),
  );

  const optionalRevisions = dedupe(
    advisorReports.flatMap((report) => report.optionalRevisions ?? []),
  );

  const failedAdvisorIds = dedupe(
    advisorReports
      .filter((report) => !report.passed)
      .map((report) => report.advisorId),
  );

  const criticalAdvisorIds = dedupe(
    advisorReports
      .filter((report) => report.risk === "critical")
      .map((report) => report.advisorId),
  );

  const highAdvisorIds = dedupe(
    advisorReports
      .filter((report) => report.risk === "high")
      .map((report) => report.advisorId),
  );

  const disagreements = getArrayProperty(
    input.disagreementResolution,
    "disagreements",
  );

  const criticalDisagreements = disagreements.filter(
    (item) =>
      isRecord(item) &&
      normalizeText(String(item.priority ?? "")) === "critical",
  ).length;

  const highDisagreements = disagreements.filter(
    (item) =>
      isRecord(item) &&
      normalizeText(String(item.priority ?? "")) === "high",
  ).length;

  const topIssues = getNestedArrayProperty(input.revisionPriority, [
    "topIssues",
  ]);

  return {
    contradictions,
    unsupportedClaims,
    missingCounterpoints,
    overAgreementSignals,
    requiredRevisions,
    optionalRevisions,
    failedAdvisorIds,
    criticalAdvisorIds,
    highAdvisorIds,
    criticalDisagreements,
    highDisagreements,
    topIssueCount: topIssues.length,
    mustBlock: getBooleanProperty(input.revisionPriority, "mustBlock"),
    mustRegenerate: getBooleanProperty(input.revisionPriority, "mustRegenerate"),
    mustRevise: getBooleanProperty(input.revisionPriority, "mustRevise"),
  };
}

function collectScoreSnapshot(scores: CouncilScoringState): ScoreSnapshot {
  return {
    sycophancy: getScoreLevel(scores, "sycophancy"),
    evidence: getScoreLevel(scores, "evidence"),
    userBenefit: getScoreLevel(scores, "userBenefit"),
    confidenceCalibration: getScoreLevel(scores, "confidenceCalibration"),
    answerIntegrity: getScoreLevel(scores, "answerIntegrity"),
    criticalDepth: getScoreLevel(scores, "criticalDepth"),
    completeness: getScoreLevel(scores, "completeness"),
  };
}

function hasCriticalIntegrityFailure(scores: ScoreSnapshot): boolean {
  return (
    scores.answerIntegrity === "critical" ||
    scores.completeness === "critical"
  );
}

function hasCriticalOrHighCoreRisk(scores: ScoreSnapshot): boolean {
  return (
    isRiskAtLeast(scores.answerIntegrity, "high") ||
    isRiskAtLeast(scores.completeness, "high") ||
    isRiskAtLeast(scores.evidence, "high")
  );
}

function calculateRecommendationConfidence(input: {
  readonly action: CouncilAction;
  readonly signals: RecommendationSignals;
  readonly scores: ScoreSnapshot;
  readonly reasoningClosurePassed: boolean;
  readonly unresolvedFrom14a: boolean;
  readonly loopExhausted: boolean;
}): number {
  let confidence = 0.84;

  switch (input.action) {
    case "approve":
      confidence = 0.86;
      break;
    case "send_with_caveat":
      confidence = 0.68;
      break;
    case "revise":
      confidence = 0.72;
      break;
    case "regenerate":
      confidence = 0.76;
      break;
    case "ask_clarification":
      confidence = 0.7;
      break;
    case "block_delivery":
      confidence = 0.86;
      break;
    default:
      confidence = 0.7;
      break;
  }

  if (input.signals.contradictions.length > 0) {
    confidence += 0.04;
  }

  if (input.signals.criticalAdvisorIds.length > 0) {
    confidence += 0.03;
  }

  if (input.signals.requiredRevisions.length > 0) {
    confidence += 0.02;
  }

  if (!input.reasoningClosurePassed || input.unresolvedFrom14a) {
    confidence += 0.03;
  }

  if (input.loopExhausted && input.action === "block_delivery") {
    confidence += 0.04;
  }

  const elevatedRiskCount = Object.values(input.scores).filter(
    (risk) => risk !== "low",
  ).length;

  if (input.action === "approve" && elevatedRiskCount > 0) {
    confidence -= 0.12;
  }

  if (input.action === "send_with_caveat" && elevatedRiskCount > 2) {
    confidence -= 0.06;
  }

  return round(clamp(confidence, 0.35, 0.96), 3);
}

function getScoreLevel(
  scores: CouncilScoringState,
  key: string,
): CouncilRiskLevel {
  if (!isRecord(scores)) {
    return "low";
  }

  const value = scores[key];

  if (!isRecord(value)) {
    return "low";
  }

  const level = value.level;

  if (
    level === "low" ||
    level === "medium" ||
    level === "high" ||
    level === "critical"
  ) {
    return level;
  }

  return "low";
}

function getBooleanProperty(source: unknown, key: string): boolean {
  if (!isRecord(source)) {
    return false;
  }

  return source[key] === true;
}

function getArrayProperty(source: unknown, key: string): unknown[] {
  if (!isRecord(source)) {
    return [];
  }

  const value = source[key];

  return Array.isArray(value) ? value : [];
}

function getNestedArrayProperty(
  source: unknown,
  path: readonly string[],
): unknown[] {
  let current: unknown = source;

  for (const segment of path) {
    if (!isRecord(current)) {
      return [];
    }

    current = current[segment];
  }

  return Array.isArray(current) ? current : [];
}

function normalizeAdvisorReports(
  advisorReports: readonly CouncilAdvisorReport[] | undefined,
): CouncilAdvisorReport[] {
  if (!Array.isArray(advisorReports)) {
    return [];
  }

  return advisorReports.filter(Boolean);
}

function isRiskAtLeast(
  risk: CouncilRiskLevel,
  minimum: CouncilRiskLevel,
): boolean {
  return RISK_WEIGHT[risk] >= RISK_WEIGHT[minimum];
}

function moreConservativeAction(
  left: CouncilAction,
  right: CouncilAction,
): CouncilAction {
  return ACTION_PRIORITY[left] >= ACTION_PRIORITY[right] ? left : right;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}