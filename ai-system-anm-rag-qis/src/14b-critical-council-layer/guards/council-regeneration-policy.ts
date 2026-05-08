import type { CouncilAction, CouncilRiskLevel } from "../council-types";

export interface CouncilRegenerationPolicyInput {
  readonly sycophancyRisk: CouncilRiskLevel;
  readonly logicRisk: CouncilRiskLevel;
  readonly evidenceRisk: CouncilRiskLevel;
  readonly completenessRisk: CouncilRiskLevel;
  readonly communicationRisk: CouncilRiskLevel;

  readonly hasMissingCounterpoints: boolean;
  readonly hasUnsupportedClaims: boolean;
  readonly hasContradictions: boolean;

  readonly hasRequiredRevisions?: boolean;
  readonly hasCriticalAdvisorFailure?: boolean;
  readonly hasHighAdvisorFailure?: boolean;
  readonly hasDeliveryBlockerSignal?: boolean;
  readonly hasWeakCritiqueSignal?: boolean;
  readonly hasPrematureApprovalSignal?: boolean;
  readonly hasUnsupportedConfidenceSignal?: boolean;

  readonly revisionAttempts?: number;
  readonly maxRevisionAttempts?: number;
}

export interface CouncilPolicyEvaluation {
  readonly action: CouncilAction;
  readonly dominantRisk: CouncilRiskLevel;
  readonly weightedRisk: number;
  readonly revisionBudgetExhausted: boolean;
  readonly reasons: string[];
}

type RiskDimension =
  | "sycophancy"
  | "logic"
  | "evidence"
  | "completeness"
  | "communication";

const DEFAULT_MAX_REVISION_ATTEMPTS = 2;

const RISK_SCORE: Record<CouncilRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const RISK_WEIGHT: Record<RiskDimension, number> = {
  sycophancy: 1,
  logic: 1.35,
  evidence: 1.15,
  completeness: 1.3,
  communication: 0.85,
};

const ACTION_PRIORITY: Record<CouncilAction, number> = {
  approve: 0,
  send_with_caveat: 1,
  revise: 2,
  ask_clarification: 3,
  regenerate: 4,
  block_delivery: 5,
};

export function resolveCouncilAction(
  input: CouncilRegenerationPolicyInput,
): CouncilAction {
  return evaluateCouncilRegenerationPolicy(input).action;
}

export function evaluateCouncilRegenerationPolicy(
  input: CouncilRegenerationPolicyInput,
): CouncilPolicyEvaluation {
  const dominantRisk = getDominantRisk(input);
  const weightedRisk = getWeightedRisk(input);
  const revisionBudgetExhausted = hasRevisionBudgetExhausted(input);
  const reasons: string[] = [];

  const hardBlockAction = evaluateHardBlockConditions(
    input,
    revisionBudgetExhausted,
    reasons,
  );

  if (hardBlockAction) {
    return {
      action: hardBlockAction,
      dominantRisk,
      weightedRisk,
      revisionBudgetExhausted,
      reasons: dedupe(reasons),
    };
  }

  const criticalAction = evaluateCriticalRiskConditions(
    input,
    revisionBudgetExhausted,
    reasons,
  );

  if (criticalAction) {
    return {
      action: criticalAction,
      dominantRisk,
      weightedRisk,
      revisionBudgetExhausted,
      reasons: dedupe(reasons),
    };
  }

  const highRiskAction = evaluateHighRiskConditions(
    input,
    revisionBudgetExhausted,
    reasons,
  );

  if (highRiskAction) {
    return {
      action: highRiskAction,
      dominantRisk,
      weightedRisk,
      revisionBudgetExhausted,
      reasons: dedupe(reasons),
    };
  }

  const mediumRiskAction = evaluateMediumRiskConditions(
    input,
    weightedRisk,
    reasons,
  );

  if (mediumRiskAction) {
    return {
      action: mediumRiskAction,
      dominantRisk,
      weightedRisk,
      revisionBudgetExhausted,
      reasons: dedupe(reasons),
    };
  }

  reasons.push("No material council risk requires revision, regeneration or caveated delivery.");

  return {
    action: "approve",
    dominantRisk,
    weightedRisk,
    revisionBudgetExhausted,
    reasons: dedupe(reasons),
  };
}

function evaluateHardBlockConditions(
  input: CouncilRegenerationPolicyInput,
  revisionBudgetExhausted: boolean,
  reasons: string[],
): CouncilAction | null {
  if (input.hasDeliveryBlockerSignal) {
    reasons.push("A final delivery blocker signal was detected.");
    return "block_delivery";
  }

  if (input.hasContradictions) {
    reasons.push("Contradictions were detected.");

    return revisionBudgetExhausted ? "block_delivery" : "regenerate";
  }

  if (input.logicRisk === "critical") {
    reasons.push("Logic risk is critical.");

    return revisionBudgetExhausted ? "block_delivery" : "regenerate";
  }

  if (input.completenessRisk === "critical") {
    reasons.push("Completeness risk is critical.");

    return revisionBudgetExhausted ? "block_delivery" : "regenerate";
  }

  if (input.evidenceRisk === "critical" && input.hasUnsupportedClaims) {
    reasons.push("Evidence risk is critical and unsupported claims are present.");

    return revisionBudgetExhausted ? "block_delivery" : "regenerate";
  }

  if (input.hasCriticalAdvisorFailure && revisionBudgetExhausted) {
    reasons.push("A critical advisor failure remains after revision budget exhaustion.");

    return "block_delivery";
  }

  return null;
}

function evaluateCriticalRiskConditions(
  input: CouncilRegenerationPolicyInput,
  revisionBudgetExhausted: boolean,
  reasons: string[],
): CouncilAction | null {
  if (input.sycophancyRisk === "critical") {
    reasons.push("Sycophancy risk is critical.");

    return revisionBudgetExhausted ? "block_delivery" : "revise";
  }

  if (input.communicationRisk === "critical") {
    reasons.push("Communication risk is critical.");

    return revisionBudgetExhausted ? "block_delivery" : "revise";
  }

  if (input.evidenceRisk === "critical") {
    reasons.push("Evidence risk is critical.");

    return revisionBudgetExhausted ? "block_delivery" : "revise";
  }

  return null;
}

function evaluateHighRiskConditions(
  input: CouncilRegenerationPolicyInput,
  revisionBudgetExhausted: boolean,
  reasons: string[],
): CouncilAction | null {
  if (input.logicRisk === "high" || input.completenessRisk === "high") {
    reasons.push("High logic or completeness risk requires regeneration.");

    return revisionBudgetExhausted ? "block_delivery" : "regenerate";
  }

  if (input.hasUnsupportedClaims && isRiskAtLeast(input.evidenceRisk, "medium")) {
    reasons.push("Unsupported claims are present with elevated evidence risk.");

    return revisionBudgetExhausted ? "block_delivery" : "revise";
  }

  if (input.hasMissingCounterpoints && isRiskAtLeast(input.sycophancyRisk, "medium")) {
    reasons.push("Missing counterpoints are present with elevated sycophancy risk.");

    return revisionBudgetExhausted ? "send_with_caveat" : "revise";
  }

  if (input.sycophancyRisk === "high") {
    reasons.push("High sycophancy risk requires revision.");

    return revisionBudgetExhausted ? "send_with_caveat" : "revise";
  }

  if (input.evidenceRisk === "high") {
    reasons.push("High evidence risk requires revision.");

    return revisionBudgetExhausted ? "send_with_caveat" : "revise";
  }

  if (input.communicationRisk === "high") {
    reasons.push("High communication risk requires revision.");

    return revisionBudgetExhausted ? "send_with_caveat" : "revise";
  }

  if (input.hasRequiredRevisions || input.hasHighAdvisorFailure) {
    reasons.push("Required revisions or high advisor failure detected.");

    return revisionBudgetExhausted ? "send_with_caveat" : "revise";
  }

  return null;
}

function evaluateMediumRiskConditions(
  input: CouncilRegenerationPolicyInput,
  weightedRisk: number,
  reasons: string[],
): CouncilAction | null {
  if (input.hasPrematureApprovalSignal) {
    reasons.push("Premature approval signal detected.");

    return "revise";
  }

  if (input.hasWeakCritiqueSignal) {
    reasons.push("Weak critique signal detected.");

    return "revise";
  }

  if (input.hasUnsupportedConfidenceSignal) {
    reasons.push("Unsupported confidence signal detected.");

    return "revise";
  }

  if (input.hasMissingCounterpoints) {
    reasons.push("Missing counterpoint detected.");

    return "revise";
  }

  if (weightedRisk >= 6) {
    reasons.push(`Weighted council risk is ${weightedRisk}, which requires regeneration.`);

    return "regenerate";
  }

  if (weightedRisk >= 3) {
    reasons.push(`Weighted council risk is ${weightedRisk}, which requires revision.`);

    return "revise";
  }

  if (
    input.evidenceRisk === "medium" ||
    input.logicRisk === "medium" ||
    input.completenessRisk === "medium"
  ) {
    reasons.push("Medium evidence, logic or completeness risk requires caveated delivery.");

    return "send_with_caveat";
  }

  if (
    input.sycophancyRisk === "medium" ||
    input.communicationRisk === "medium"
  ) {
    reasons.push("Medium sycophancy or communication risk requires revision.");

    return "revise";
  }

  return null;
}

function getDominantRisk(input: CouncilRegenerationPolicyInput): CouncilRiskLevel {
  return maxRisk([
    input.sycophancyRisk,
    input.logicRisk,
    input.evidenceRisk,
    input.completenessRisk,
    input.communicationRisk,
  ]);
}

function getWeightedRisk(input: CouncilRegenerationPolicyInput): number {
  const weighted =
    riskToScore(input.sycophancyRisk) * RISK_WEIGHT.sycophancy +
    riskToScore(input.logicRisk) * RISK_WEIGHT.logic +
    riskToScore(input.evidenceRisk) * RISK_WEIGHT.evidence +
    riskToScore(input.completenessRisk) * RISK_WEIGHT.completeness +
    riskToScore(input.communicationRisk) * RISK_WEIGHT.communication;

  return round(weighted, 3);
}

export function riskToScore(risk: CouncilRiskLevel): number {
  return RISK_SCORE[risk] ?? 0;
}

function isRiskAtLeast(
  risk: CouncilRiskLevel,
  minimum: CouncilRiskLevel,
): boolean {
  return riskToScore(risk) >= riskToScore(minimum);
}

function maxRisk(risks: readonly CouncilRiskLevel[]): CouncilRiskLevel {
  return risks.reduce<CouncilRiskLevel>((highest, current) => {
    return riskToScore(current) > riskToScore(highest) ? current : highest;
  }, "low");
}

function hasRevisionBudgetExhausted(
  input: CouncilRegenerationPolicyInput,
): boolean {
  const maxAttempts = normalizeAttemptCount(
    input.maxRevisionAttempts,
    DEFAULT_MAX_REVISION_ATTEMPTS,
  );

  const attempts = normalizeAttemptCount(input.revisionAttempts, 0);

  return attempts >= maxAttempts;
}

function normalizeAttemptCount(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
}

function round(value: number, decimals: number): number {
  const factor = 10 ** Math.max(0, Math.floor(decimals));

  return Math.round(value * factor) / factor;
}

function dedupe(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = String(value ?? "").trim();

    if (!cleaned || seen.has(cleaned)) {
      continue;
    }

    seen.add(cleaned);
    result.push(cleaned);
  }

  return result;
}

export function moreConservativeCouncilAction(
  left: CouncilAction,
  right: CouncilAction,
): CouncilAction {
  return actionPriority(left) >= actionPriority(right) ? left : right;
}

function actionPriority(action: CouncilAction): number {
  return ACTION_PRIORITY[action] ?? ACTION_PRIORITY.revise;
}