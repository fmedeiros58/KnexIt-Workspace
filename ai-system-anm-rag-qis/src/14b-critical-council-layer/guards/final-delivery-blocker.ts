import type {
  CouncilAction,
  CouncilAssessmentBase,
  CouncilRevisionPlan,
  CouncilRiskLevel,
  CouncilSecondPassResult,
  CouncilSynthesisResult,
  FinalDeliveryDecision,
  PrematureApprovalGuardResult,
  UnsupportedConfidenceGuardResult,
  WeakCritiqueGuardResult,
} from "../council-types";

type DeliveryReasonSeverity = "soft" | "medium" | "hard" | "blocking";

interface DeliveryReason {
  readonly code: string;
  readonly severity: DeliveryReasonSeverity;
  readonly message: string;
  readonly preferredAction?: CouncilAction;
}

interface DeliveryRiskSnapshot {
  readonly sycophancyRisk: CouncilRiskLevel;
  readonly logicRisk: CouncilRiskLevel;
  readonly evidenceRisk: CouncilRiskLevel;
  readonly completenessRisk: CouncilRiskLevel;
  readonly communicationRisk: CouncilRiskLevel;
}

interface FinalDeliveryBlockerInput {
  readonly baseAssessment: CouncilAssessmentBase;
  readonly synthesis: CouncilSynthesisResult;
  readonly weakCritiqueGuard: WeakCritiqueGuardResult;
  readonly prematureApprovalGuard: PrematureApprovalGuardResult;
  readonly unsupportedConfidenceGuard: UnsupportedConfidenceGuardResult;
  readonly revisionPlan: CouncilRevisionPlan;
  readonly secondPass?: CouncilSecondPassResult;
  readonly userGoalSatisfied: boolean;
}

const ACTION_PRIORITY: Record<CouncilAction, number> = {
  approve: 0,
  send_with_caveat: 1,
  revise: 2,
  ask_clarification: 3,
  regenerate: 4,
  block_delivery: 5,
};

const RISK_PRIORITY: Record<CouncilRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function decideFinalCouncilDelivery(
  input: FinalDeliveryBlockerInput,
): FinalDeliveryDecision {
  const recommendation = input.synthesis.finalRecommendation;
  const initialAction = recommendation?.action ?? input.baseAssessment.action ?? "revise";

  const reasons = collectDeliveryReasons(input);
  const requiredAction = resolveRequiredAction({
    initialAction,
    reasons,
    revisionPlan: input.revisionPlan,
    secondPass: input.secondPass,
  });

  return {
    canDeliver: canDeliverWithAction(requiredAction, reasons),
    requiredAction,
    reasons: reasons.map((reason) => reason.code),
  };
}

function collectDeliveryReasons(
  input: FinalDeliveryBlockerInput,
): DeliveryReason[] {
  return dedupeReasons([
    ...collectSynthesisReasons(input),
    ...collectRiskReasons(input.baseAssessment),
    ...collectAssessmentContentReasons(input.baseAssessment),
    ...collectGuardReasons(input),
    ...collectRevisionReasons(input.revisionPlan),
    ...collectSecondPassReasons(input.secondPass),
    ...collectUserGoalReasons(input.userGoalSatisfied),
  ]);
}

function collectSynthesisReasons(
  input: FinalDeliveryBlockerInput,
): DeliveryReason[] {
  const recommendation = input.synthesis.finalRecommendation;
  const reasons: DeliveryReason[] = [];

  if (!recommendation) {
    reasons.push({
      code: "missing_synthesis_final_recommendation",
      severity: "hard",
      message:
        "Council synthesis did not provide a final recommendation.",
      preferredAction: "revise",
    });

    return reasons;
  }

  if (recommendation.action === "block_delivery") {
    reasons.push({
      code: "synthesis_requested_block_delivery",
      severity: "blocking",
      message:
        "Council synthesis explicitly requested delivery blocking.",
      preferredAction: "block_delivery",
    });
  }

  if (recommendation.action === "regenerate") {
    reasons.push({
      code: "synthesis_requested_regeneration",
      severity: "hard",
      message:
        "Council synthesis requested answer regeneration.",
      preferredAction: "regenerate",
    });
  }

  if (recommendation.action === "revise") {
    reasons.push({
      code: "synthesis_requested_revision",
      severity: "medium",
      message:
        "Council synthesis requested revision before delivery.",
      preferredAction: "revise",
    });
  }

  if (recommendation.deliveryBlocked) {
    reasons.push({
      code: "synthesis_delivery_blocked_flag",
      severity: "blocking",
      message:
        "Council synthesis marked delivery as blocked.",
      preferredAction: "block_delivery",
    });
  }

  if ((recommendation.requiredRevisions ?? []).length > 0) {
    reasons.push({
      code: "synthesis_required_revisions_pending",
      severity: "medium",
      message:
        "Council synthesis still contains required revisions.",
      preferredAction: "revise",
    });
  }

  return reasons;
}

function collectRiskReasons(
  assessment: CouncilAssessmentBase,
): DeliveryReason[] {
  const risks = getRiskSnapshot(assessment);
  const reasons: DeliveryReason[] = [];

  if (risks.logicRisk === "critical") {
    reasons.push({
      code: "critical_logic_risk",
      severity: "blocking",
      message:
        "Logic risk is critical and cannot be delivered.",
      preferredAction: "block_delivery",
    });
  } else if (risks.logicRisk === "high") {
    reasons.push({
      code: "high_logic_risk",
      severity: "hard",
      message:
        "Logic risk is high and must be corrected before delivery.",
      preferredAction: "regenerate",
    });
  }

  if (risks.completenessRisk === "critical") {
    reasons.push({
      code: "critical_completeness_risk",
      severity: "blocking",
      message:
        "Completeness risk is critical and cannot be delivered.",
      preferredAction: "block_delivery",
    });
  } else if (risks.completenessRisk === "high") {
    reasons.push({
      code: "high_completeness_risk",
      severity: "hard",
      message:
        "Completeness risk is high and must be corrected before delivery.",
      preferredAction: "regenerate",
    });
  }

  if (risks.evidenceRisk === "critical") {
    reasons.push({
      code: "critical_evidence_risk",
      severity: "hard",
      message:
        "Evidence risk is critical and requires regeneration or revision before delivery.",
      preferredAction: "regenerate",
    });
  } else if (risks.evidenceRisk === "high") {
    reasons.push({
      code: "high_evidence_risk",
      severity: "medium",
      message:
        "Evidence risk is high and requires revision before delivery.",
      preferredAction: "revise",
    });
  }

  if (risks.sycophancyRisk === "critical") {
    reasons.push({
      code: "critical_sycophancy_risk",
      severity: "hard",
      message:
        "Sycophancy risk is critical and requires revision before delivery.",
      preferredAction: "revise",
    });
  } else if (risks.sycophancyRisk === "high") {
    reasons.push({
      code: "high_sycophancy_risk",
      severity: "medium",
      message:
        "Sycophancy risk is high and requires revision before delivery.",
      preferredAction: "revise",
    });
  }

  if (risks.communicationRisk === "critical") {
    reasons.push({
      code: "critical_communication_risk",
      severity: "hard",
      message:
        "Communication risk is critical and requires revision before delivery.",
      preferredAction: "revise",
    });
  } else if (risks.communicationRisk === "high") {
    reasons.push({
      code: "high_communication_risk",
      severity: "medium",
      message:
        "Communication risk is high and requires revision before delivery.",
      preferredAction: "revise",
    });
  }

  return reasons;
}

function collectAssessmentContentReasons(
  assessment: CouncilAssessmentBase,
): DeliveryReason[] {
  const reasons: DeliveryReason[] = [];

  if ((assessment.contradictions ?? []).length > 0) {
    reasons.push({
      code: "unresolved_contradictions",
      severity: "blocking",
      message:
        "Unresolved contradictions remain in the council assessment.",
      preferredAction: "block_delivery",
    });
  }

  if ((assessment.unsupportedClaims ?? []).length > 0) {
    reasons.push({
      code: "unsupported_claims_pending",
      severity: "medium",
      message:
        "Unsupported claims remain in the council assessment.",
      preferredAction: "revise",
    });
  }

  if ((assessment.missingCounterpoints ?? []).length > 0) {
    reasons.push({
      code: "missing_counterpoints_pending",
      severity: "medium",
      message:
        "Missing counterpoints remain in the council assessment.",
      preferredAction: "revise",
    });
  }

  if ((assessment.overAgreementSignals ?? []).length > 0) {
    reasons.push({
      code: "over_agreement_signals_pending",
      severity: "medium",
      message:
        "Over-agreement signals remain in the council assessment.",
      preferredAction: "revise",
    });
  }

  if ((assessment.requiredRevisions ?? []).length > 0) {
    reasons.push({
      code: "required_revisions_pending",
      severity: "medium",
      message:
        "Required council revisions remain pending.",
      preferredAction: "revise",
    });
  }

  return reasons;
}

function collectGuardReasons(
  input: FinalDeliveryBlockerInput,
): DeliveryReason[] {
  const reasons: DeliveryReason[] = [];

  if (!input.weakCritiqueGuard.passed) {
    reasons.push({
      code: "weak_critique_guard_failed",
      severity: "medium",
      message:
        "Weak critique guard failed.",
      preferredAction: "revise",
    });
  }

  if (!input.prematureApprovalGuard.passed) {
    reasons.push({
      code: "premature_approval_guard_failed",
      severity: "hard",
      message:
        "Premature approval guard failed.",
      preferredAction: "revise",
    });
  }

  if (!input.unsupportedConfidenceGuard.passed) {
    reasons.push({
      code: "unsupported_confidence_guard_failed",
      severity: "medium",
      message:
        "Unsupported confidence guard failed.",
      preferredAction: "revise",
    });
  }

  return reasons;
}

function collectRevisionReasons(
  revisionPlan: CouncilRevisionPlan,
): DeliveryReason[] {
  const reasons: DeliveryReason[] = [];

  if (revisionPlan.regenerationRequired) {
    reasons.push({
      code: "revision_plan_requires_regeneration",
      severity: "hard",
      message:
        "Revision plan requires regeneration.",
      preferredAction: "regenerate",
    });
  }

  if (revisionPlan.revisionRequired) {
    reasons.push({
      code: "revision_plan_requires_revision",
      severity: "medium",
      message:
        "Revision plan requires revision.",
      preferredAction: "revise",
    });
  }

  if ((revisionPlan.rewriteInstructions ?? []).length > 0) {
    reasons.push({
      code: "revision_plan_has_rewrite_instructions",
      severity: "medium",
      message:
        "Revision plan still has rewrite instructions to apply.",
      preferredAction: "revise",
    });
  }

  return reasons;
}

function collectSecondPassReasons(
  secondPass: CouncilSecondPassResult | undefined,
): DeliveryReason[] {
  if (!secondPass) {
    return [];
  }

  const reasons: DeliveryReason[] = [];

  if (!secondPass.passed) {
    reasons.push({
      code: "second_pass_failed",
      severity: "hard",
      message:
        "Council second-pass check failed.",
      preferredAction:
        secondPass.finalAction === "approve" ? "revise" : secondPass.finalAction,
    });
  }

  if ((secondPass.remainingIssues ?? []).length > 0) {
    reasons.push({
      code: "second_pass_remaining_issues",
      severity: secondPass.passed ? "soft" : "medium",
      message:
        "Council second pass still reports remaining issues.",
      preferredAction: secondPass.passed ? "send_with_caveat" : "revise",
    });
  }

  if (secondPass.requiresAnotherPass) {
    reasons.push({
      code: "second_pass_requires_another_pass",
      severity: "medium",
      message:
        "Council second pass requires another review pass.",
      preferredAction: "revise",
    });
  }

  return reasons;
}

function collectUserGoalReasons(
  userGoalSatisfied: boolean,
): DeliveryReason[] {
  if (userGoalSatisfied) {
    return [];
  }

  return [
    {
      code: "response_not_aligned_with_user_goal",
      severity: "hard",
      message:
        "The response is not aligned with the user's goal.",
      preferredAction: "revise",
    },
  ];
}

function resolveRequiredAction(input: {
  readonly initialAction: CouncilAction;
  readonly reasons: readonly DeliveryReason[];
  readonly revisionPlan: CouncilRevisionPlan;
  readonly secondPass?: CouncilSecondPassResult;
}): CouncilAction {
  const { initialAction, reasons, revisionPlan, secondPass } = input;

  if (hasBlockingReason(reasons)) {
    return "block_delivery";
  }

  if (hasHardLogicOrCompletenessReason(reasons)) {
    return revisionPlan.regenerationRequired ? "regenerate" : "block_delivery";
  }

  if (secondPass && !secondPass.passed && secondPass.finalAction !== "approve") {
    return moreConservativeAction(initialAction, secondPass.finalAction);
  }

  const preferredAction = reasons.reduce<CouncilAction>(
    (current, reason) =>
      reason.preferredAction
        ? moreConservativeAction(current, reason.preferredAction)
        : current,
    initialAction,
  );

  if (revisionPlan.regenerationRequired) {
    return moreConservativeAction(preferredAction, "regenerate");
  }

  if (revisionPlan.revisionRequired) {
    return moreConservativeAction(preferredAction, "revise");
  }

  if (reasons.length === 0) {
    return preferredAction;
  }

  return moreConservativeAction(preferredAction, "revise");
}

function canDeliverWithAction(
  action: CouncilAction,
  reasons: readonly DeliveryReason[],
): boolean {
  if (action === "block_delivery") {
    return false;
  }

  if (action === "regenerate" || action === "revise" || action === "ask_clarification") {
    return false;
  }

  if (hasBlockingReason(reasons) || hasHardReason(reasons)) {
    return false;
  }

  if (action === "send_with_caveat") {
    return reasons.every(
      (reason) => reason.severity === "soft" || reason.severity === "medium",
    );
  }

  return action === "approve" && reasons.length === 0;
}

function getRiskSnapshot(
  assessment: CouncilAssessmentBase,
): DeliveryRiskSnapshot {
  return {
    sycophancyRisk: assessment.sycophancyRisk,
    logicRisk: assessment.logicRisk,
    evidenceRisk: assessment.evidenceRisk,
    completenessRisk: assessment.completenessRisk,
    communicationRisk: assessment.communicationRisk,
  };
}

function hasBlockingReason(reasons: readonly DeliveryReason[]): boolean {
  return reasons.some((reason) => reason.severity === "blocking");
}

function hasHardReason(reasons: readonly DeliveryReason[]): boolean {
  return reasons.some(
    (reason) => reason.severity === "hard" || reason.severity === "blocking",
  );
}

function hasHardLogicOrCompletenessReason(
  reasons: readonly DeliveryReason[],
): boolean {
  return reasons.some((reason) =>
    [
      "critical_logic_risk",
      "high_logic_risk",
      "critical_completeness_risk",
      "high_completeness_risk",
      "unresolved_contradictions",
    ].includes(reason.code),
  );
}

function moreConservativeAction(
  left: CouncilAction,
  right: CouncilAction,
): CouncilAction {
  return actionPriority(left) >= actionPriority(right) ? left : right;
}

function actionPriority(action: CouncilAction): number {
  return ACTION_PRIORITY[action] ?? ACTION_PRIORITY.revise;
}

function dedupeReasons(
  reasons: readonly DeliveryReason[],
): DeliveryReason[] {
  const byCode = new Map<string, DeliveryReason>();

  for (const reason of reasons) {
    const previous = byCode.get(reason.code);

    if (!previous) {
      byCode.set(reason.code, reason);
      continue;
    }

    byCode.set(reason.code, {
      ...previous,
      severity: maxSeverity(previous.severity, reason.severity),
      preferredAction: reason.preferredAction
        ? moreConservativeAction(
            previous.preferredAction ?? "approve",
            reason.preferredAction,
          )
        : previous.preferredAction,
    });
  }

  return Array.from(byCode.values()).sort(compareReasonPriority);
}

function compareReasonPriority(
  left: DeliveryReason,
  right: DeliveryReason,
): number {
  const severityDelta = severityScore(right.severity) - severityScore(left.severity);

  if (severityDelta !== 0) {
    return severityDelta;
  }

  return actionPriority(right.preferredAction ?? "approve") -
    actionPriority(left.preferredAction ?? "approve");
}

function maxSeverity(
  left: DeliveryReasonSeverity,
  right: DeliveryReasonSeverity,
): DeliveryReasonSeverity {
  return severityScore(left) >= severityScore(right) ? left : right;
}

function severityScore(severity: DeliveryReasonSeverity): number {
  switch (severity) {
    case "blocking":
      return 3;
    case "hard":
      return 2;
    case "medium":
      return 1;
    case "soft":
      return 0;
    default:
      return 0;
  }
}

export function isRiskAtLeast(
  risk: CouncilRiskLevel,
  minimum: CouncilRiskLevel,
): boolean {
  return RISK_PRIORITY[risk] >= RISK_PRIORITY[minimum];
}