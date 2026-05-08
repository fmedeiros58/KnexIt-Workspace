import type {
  CouncilAssessmentBase,
  CouncilRiskLevel,
  CouncilSynthesisResult,
  PrematureApprovalGuardResult,
} from "../council-types";

interface PrematureApprovalInput {
  readonly baseAssessment: CouncilAssessmentBase;
  readonly synthesis: CouncilSynthesisResult;
  readonly unresolvedFrom14a: boolean;
}

const RISK_WEIGHT: Record<CouncilRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function checkPrematureApproval(
  input: PrematureApprovalInput,
): PrematureApprovalGuardResult {
  const blockedReasons = collectPrematureApprovalReasons(input);

  return {
    passed: blockedReasons.length === 0,
    blockedReasons: dedupe(blockedReasons),
  };
}

function collectPrematureApprovalReasons(
  input: PrematureApprovalInput,
): string[] {
  const reasons: string[] = [];

  if (!isApprovalAttempt(input)) {
    return reasons;
  }

  reasons.push(...checkRiskApprovalConflicts(input.baseAssessment));
  reasons.push(...checkContentApprovalConflicts(input.baseAssessment));
  reasons.push(...checkRevisionApprovalConflicts(input.baseAssessment, input.synthesis));
  reasons.push(...checkAdvisorApprovalConflicts(input.baseAssessment));
  reasons.push(...checkSynthesisApprovalConflicts(input.synthesis));
  reasons.push(...check14aApprovalConflicts(input.unresolvedFrom14a));

  return reasons;
}

function isApprovalAttempt(input: PrematureApprovalInput): boolean {
  const recommendation = input.synthesis.finalRecommendation;

  return (
    recommendation.action === "approve" ||
    input.baseAssessment.action === "approve" ||
    input.baseAssessment.approved === true ||
    recommendation.approved === true
  );
}

function checkRiskApprovalConflicts(
  assessment: CouncilAssessmentBase,
): string[] {
  const reasons: string[] = [];

  if (isRiskAtLeast(assessment.logicRisk, "high")) {
    reasons.push("approval_with_high_logic_risk");
  }

  if (isRiskAtLeast(assessment.completenessRisk, "high")) {
    reasons.push("approval_with_high_completeness_risk");
  }

  if (isRiskAtLeast(assessment.evidenceRisk, "high")) {
    reasons.push("approval_with_high_evidence_risk");
  }

  if (isRiskAtLeast(assessment.sycophancyRisk, "high")) {
    reasons.push("approval_with_high_sycophancy_risk");
  }

  if (assessment.communicationRisk === "critical") {
    reasons.push("approval_with_critical_communication_risk");
  }

  return reasons;
}

function checkContentApprovalConflicts(
  assessment: CouncilAssessmentBase,
): string[] {
  const reasons: string[] = [];

  if ((assessment.contradictions ?? []).length > 0) {
    reasons.push("approval_with_unresolved_contradictions");
  }

  if ((assessment.unsupportedClaims ?? []).length > 0) {
    reasons.push("approval_with_unsupported_claims");
  }

  if ((assessment.missingCounterpoints ?? []).length > 0) {
    reasons.push("approval_with_missing_counterpoints");
  }

  if ((assessment.overAgreementSignals ?? []).length > 0) {
    reasons.push("approval_with_over_agreement_signals");
  }

  if ((assessment.requiredRevisions ?? []).length > 0) {
    reasons.push("approval_with_required_revisions_pending");
  }

  return reasons;
}

function checkRevisionApprovalConflicts(
  assessment: CouncilAssessmentBase,
  synthesis: CouncilSynthesisResult,
): string[] {
  const reasons: string[] = [];
  const recommendation = synthesis.finalRecommendation;

  if ((recommendation.requiredRevisions ?? []).length > 0) {
    reasons.push("approval_with_synthesis_required_revisions_pending");
  }

  if (recommendation.deliveryBlocked) {
    reasons.push("approval_while_synthesis_delivery_is_blocked");
  }

  if (
    recommendation.action === "approve" &&
    assessment.action !== "approve" &&
    assessment.approved === false
  ) {
    reasons.push("synthesis_approval_conflicts_with_base_assessment");
  }

  if (
    recommendation.action === "approve" &&
    ["revise", "regenerate", "ask_clarification", "block_delivery"].includes(
      assessment.action,
    )
  ) {
    reasons.push("approval_attempt_overrides_safer_base_action");
  }

  return reasons;
}

function checkAdvisorApprovalConflicts(
  assessment: CouncilAssessmentBase,
): string[] {
  const reasons: string[] = [];
  const reports = assessment.advisorReports ?? [];

  const failedAdvisors = reports.filter((report) => !report.passed);
  const criticalAdvisors = reports.filter((report) => report.risk === "critical");
  const highAdvisors = reports.filter((report) => report.risk === "high");

  if (failedAdvisors.length > 0) {
    reasons.push("approval_with_failed_advisors");
  }

  if (criticalAdvisors.length > 0) {
    reasons.push("approval_with_critical_advisor_findings");
  }

  if (highAdvisors.length > 0) {
    reasons.push("approval_with_high_advisor_findings");
  }

  return reasons;
}

function checkSynthesisApprovalConflicts(
  synthesis: CouncilSynthesisResult,
): string[] {
  const reasons: string[] = [];
  const recommendation = synthesis.finalRecommendation;

  if (recommendation.action === "approve" && recommendation.confidence < 0.55) {
    reasons.push("approval_with_low_synthesis_confidence");
  }

  if (
    recommendation.action === "approve" &&
    (recommendation.caveats ?? []).length > 0
  ) {
    reasons.push("approval_should_be_caveated");
  }

  if (
    recommendation.action === "approve" &&
    recommendation.regenerationAllowed === true &&
    (recommendation.reasons ?? []).some((reason) =>
      containsAny(reason, [
        "critical",
        "contradiction",
        "unsupported",
        "incomplete",
        "closure",
        "sycophancy",
      ]),
    )
  ) {
    reasons.push("approval_with_unresolved_synthesis_risk_reason");
  }

  return reasons;
}

function check14aApprovalConflicts(unresolvedFrom14a: boolean): string[] {
  if (!unresolvedFrom14a) {
    return [];
  }

  return ["approval_while_14a_has_pending_closure_issues"];
}

function isRiskAtLeast(
  risk: CouncilRiskLevel,
  minimum: CouncilRiskLevel,
): boolean {
  return RISK_WEIGHT[risk] >= RISK_WEIGHT[minimum];
}

function containsAny(text: string, fragments: readonly string[]): boolean {
  const normalized = String(text ?? "").toLowerCase();

  return fragments.some((fragment) =>
    normalized.includes(String(fragment ?? "").toLowerCase()),
  );
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