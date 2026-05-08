import type {
  CouncilAction,
  CouncilAdvisorReport,
  CouncilAssessmentBase,
  CouncilRiskLevel,
} from "../council-types";
import {
  dedupeNormalized,
  isRiskAtLeast,
  maxRiskLevel,
  riskWeight,
} from "./advisor-utils";

interface SynthesisInput {
  readonly advisorReports: CouncilAdvisorReport[];
  readonly sycophancyRisk: CouncilRiskLevel;
  readonly logicRisk: CouncilRiskLevel;
  readonly evidenceRisk: CouncilRiskLevel;
  readonly completenessRisk: CouncilRiskLevel;
  readonly communicationRisk: CouncilRiskLevel;
  readonly proposedAction: CouncilAction;
}

interface AggregatedAdvisorSignals {
  readonly allConcerns: string[];
  readonly allRequiredRevisions: string[];
  readonly allOptionalRevisions: string[];
  readonly missingCounterpoints: string[];
  readonly unsupportedClaims: string[];
  readonly contradictions: string[];
  readonly overAgreementSignals: string[];
  readonly failedAdvisorIds: string[];
  readonly criticalAdvisorIds: string[];
  readonly highAdvisorIds: string[];
}

const ACTION_PRIORITY: Record<CouncilAction, number> = {
  approve: 0,
  revise: 1,
  send_with_caveat: 2,
  ask_clarification: 3,
  regenerate: 4,
  block_delivery: 5,
};

const ACTION_LABELS: Record<CouncilAction, string> = {
  approve: "approve",
  revise: "revise",
  send_with_caveat: "send with caveat",
  ask_clarification: "ask clarification",
  regenerate: "regenerate",
  block_delivery: "block delivery",
};

export function runSynthesisAdvisor(
  input: SynthesisInput,
): CouncilAssessmentBase {
  const reports = input.advisorReports ?? [];
  const aggregated = aggregateAdvisorSignals(reports);

  const dominantRisk = maxRiskLevel([
    input.sycophancyRisk,
    input.logicRisk,
    input.evidenceRisk,
    input.completenessRisk,
    input.communicationRisk,
    ...reports.map((report) => report.risk),
  ]);

  const safestAction = chooseSafestAction({
    proposedAction: input.proposedAction,
    dominantRisk,
    reports,
    aggregated,
    risks: {
      sycophancyRisk: input.sycophancyRisk,
      logicRisk: input.logicRisk,
      evidenceRisk: input.evidenceRisk,
      completenessRisk: input.completenessRisk,
      communicationRisk: input.communicationRisk,
    },
  });

  const approved = canApprove({
    action: safestAction,
    dominantRisk,
    reports,
    aggregated,
  });

  const finalAction: CouncilAction = approved ? "approve" : safestAction;

  return {
    approved,
    action: finalAction,

    sycophancyRisk: input.sycophancyRisk,
    logicRisk: input.logicRisk,
    evidenceRisk: input.evidenceRisk,
    completenessRisk: input.completenessRisk,
    communicationRisk: input.communicationRisk,

    mainConcerns: prioritizeConcerns(aggregated.allConcerns),
    missingCounterpoints: aggregated.missingCounterpoints,
    unsupportedClaims: aggregated.unsupportedClaims,
    contradictions: aggregated.contradictions,
    overAgreementSignals: aggregated.overAgreementSignals,

    requiredRevisions: prioritizeRevisions(aggregated.allRequiredRevisions),
    optionalRevisions: aggregated.allOptionalRevisions,

    synthesisInstruction: buildSynthesisInstruction({
      action: finalAction,
      approved,
      dominantRisk,
      aggregated,
      risks: {
        sycophancyRisk: input.sycophancyRisk,
        logicRisk: input.logicRisk,
        evidenceRisk: input.evidenceRisk,
        completenessRisk: input.completenessRisk,
        communicationRisk: input.communicationRisk,
      },
    }),

    advisorReports: reports,
  };
}

function aggregateAdvisorSignals(
  reports: readonly CouncilAdvisorReport[],
): AggregatedAdvisorSignals {
  return {
    allConcerns: dedupeNormalized(
      reports.flatMap((report) => report.concerns ?? []),
    ),
    allRequiredRevisions: dedupeNormalized(
      reports.flatMap((report) => report.requiredRevisions ?? []),
    ),
    allOptionalRevisions: dedupeNormalized(
      reports.flatMap((report) => report.optionalRevisions ?? []),
    ),
    missingCounterpoints: dedupeNormalized(
      reports.flatMap((report) => report.missingCounterpoints ?? []),
    ),
    unsupportedClaims: dedupeNormalized(
      reports.flatMap((report) => report.unsupportedClaims ?? []),
    ),
    contradictions: dedupeNormalized(
      reports.flatMap((report) => report.contradictions ?? []),
    ),
    overAgreementSignals: dedupeNormalized(
      reports.flatMap((report) => report.overAgreementSignals ?? []),
    ),
    failedAdvisorIds: dedupeNormalized(
      reports
        .filter((report) => !report.passed)
        .map((report) => report.advisorId),
    ),
    criticalAdvisorIds: dedupeNormalized(
      reports
        .filter((report) => report.risk === "critical")
        .map((report) => report.advisorId),
    ),
    highAdvisorIds: dedupeNormalized(
      reports
        .filter((report) => report.risk === "high")
        .map((report) => report.advisorId),
    ),
  };
}

function chooseSafestAction(params: {
  readonly proposedAction: CouncilAction;
  readonly dominantRisk: CouncilRiskLevel;
  readonly reports: readonly CouncilAdvisorReport[];
  readonly aggregated: AggregatedAdvisorSignals;
  readonly risks: {
    readonly sycophancyRisk: CouncilRiskLevel;
    readonly logicRisk: CouncilRiskLevel;
    readonly evidenceRisk: CouncilRiskLevel;
    readonly completenessRisk: CouncilRiskLevel;
    readonly communicationRisk: CouncilRiskLevel;
  };
}): CouncilAction {
  const riskDrivenAction = chooseRiskDrivenAction(params);

  return moreConservativeAction(params.proposedAction, riskDrivenAction);
}

function chooseRiskDrivenAction(params: {
  readonly dominantRisk: CouncilRiskLevel;
  readonly reports: readonly CouncilAdvisorReport[];
  readonly aggregated: AggregatedAdvisorSignals;
  readonly risks: {
    readonly sycophancyRisk: CouncilRiskLevel;
    readonly logicRisk: CouncilRiskLevel;
    readonly evidenceRisk: CouncilRiskLevel;
    readonly completenessRisk: CouncilRiskLevel;
    readonly communicationRisk: CouncilRiskLevel;
  };
}): CouncilAction {
  const { dominantRisk, aggregated, risks } = params;

  if (aggregated.contradictions.length > 0) {
    return "regenerate";
  }

  if (
    risks.logicRisk === "critical" ||
    risks.completenessRisk === "critical" ||
    risks.evidenceRisk === "critical"
  ) {
    return "regenerate";
  }

  if (
    risks.sycophancyRisk === "critical" ||
    risks.communicationRisk === "critical"
  ) {
    return "revise";
  }

  if (
    isRiskAtLeast(risks.logicRisk, "high") ||
    isRiskAtLeast(risks.completenessRisk, "high") ||
    isRiskAtLeast(risks.evidenceRisk, "high")
  ) {
    return "revise";
  }

  if (
    isRiskAtLeast(risks.sycophancyRisk, "high") ||
    isRiskAtLeast(risks.communicationRisk, "high")
  ) {
    return "revise";
  }

  if (dominantRisk === "medium") {
    return "revise";
  }

  if (hasRequiredRevisions(aggregated)) {
    return "revise";
  }

  if (hasOnlySoftIssues(aggregated)) {
    return "send_with_caveat";
  }

  return "approve";
}

function canApprove(params: {
  readonly action: CouncilAction;
  readonly dominantRisk: CouncilRiskLevel;
  readonly reports: readonly CouncilAdvisorReport[];
  readonly aggregated: AggregatedAdvisorSignals;
}): boolean {
  if (params.action !== "approve") {
    return false;
  }

  if (params.dominantRisk !== "low") {
    return false;
  }

  if (params.aggregated.failedAdvisorIds.length > 0) {
    return false;
  }

  if (params.aggregated.allRequiredRevisions.length > 0) {
    return false;
  }

  if (params.aggregated.contradictions.length > 0) {
    return false;
  }

  if (params.aggregated.unsupportedClaims.length > 0) {
    return false;
  }

  return params.reports.every((report) => report.passed);
}

function buildSynthesisInstruction(params: {
  readonly action: CouncilAction;
  readonly approved: boolean;
  readonly dominantRisk: CouncilRiskLevel;
  readonly aggregated: AggregatedAdvisorSignals;
  readonly risks: {
    readonly sycophancyRisk: CouncilRiskLevel;
    readonly logicRisk: CouncilRiskLevel;
    readonly evidenceRisk: CouncilRiskLevel;
    readonly completenessRisk: CouncilRiskLevel;
    readonly communicationRisk: CouncilRiskLevel;
  };
}): string {
  const instructionParts: string[] = [];

  instructionParts.push(buildActionInstruction(params.action, params.approved));

  const riskSummary = buildRiskSummary(params.risks);

  if (riskSummary) {
    instructionParts.push(riskSummary);
  }

  if (params.dominantRisk !== "low") {
    instructionParts.push(
      `Dominant council risk is ${params.dominantRisk}; do not approve without addressing the highest-priority findings.`,
    );
  }

  if (params.aggregated.contradictions.length > 0) {
    instructionParts.push(
      "Resolve contradictions before final structure or delivery.",
    );
  }

  if (params.aggregated.unsupportedClaims.length > 0) {
    instructionParts.push(
      "Remove unsupported certainty or add concrete support for factual claims.",
    );
  }

  if (params.aggregated.missingCounterpoints.length > 0) {
    instructionParts.push(
      "Add the missing counterpoint, limitation or alternative hypothesis before concluding.",
    );
  }

  if (params.aggregated.overAgreementSignals.length > 0) {
    instructionParts.push(
      "Reduce over-agreement and preserve epistemic independence from the user's premise.",
    );
  }

  if (params.aggregated.allRequiredRevisions.length > 0) {
    instructionParts.push(
      "Apply all required revisions before passing the response to the structure and validation layers.",
    );
  }

  return dedupeNormalized(instructionParts).join(" ");
}

function buildActionInstruction(
  action: CouncilAction,
  approved: boolean,
): string {
  if (approved) {
    return "Approved by the Critical Council. Keep epistemic independence and proceed to final response structuring.";
  }

  switch (action) {
    case "ask_clarification":
      return "Clarification is required before a reliable final answer can be produced.";

    case "regenerate":
      return "Regenerate the candidate answer with stronger logical closure, evidence separation, completeness and independent critique.";

    case "revise":
      return "Revise the candidate answer using the Council's required revisions before final structuring.";

    case "send_with_caveat":
      return "The answer may proceed only with explicit caveats, uncertainty boundaries or limitations.";

    case "block_delivery":
      return "Block delivery until critical Council findings are resolved.";

    case "approve":
      return "Approved by the Critical Council.";

    default:
      return "Revise the candidate answer before final delivery.";
  }
}

function buildRiskSummary(risks: {
  readonly sycophancyRisk: CouncilRiskLevel;
  readonly logicRisk: CouncilRiskLevel;
  readonly evidenceRisk: CouncilRiskLevel;
  readonly completenessRisk: CouncilRiskLevel;
  readonly communicationRisk: CouncilRiskLevel;
}): string {
  const elevatedRisks = Object.entries(risks)
    .filter(([, risk]) => risk !== "low")
    .map(([key, risk]) => `${key}:${risk}`);

  if (elevatedRisks.length === 0) {
    return "";
  }

  return `Elevated risk dimensions: ${elevatedRisks.join(", ")}.`;
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

function hasRequiredRevisions(
  aggregated: AggregatedAdvisorSignals,
): boolean {
  return aggregated.allRequiredRevisions.length > 0;
}

function hasOnlySoftIssues(
  aggregated: AggregatedAdvisorSignals,
): boolean {
  return (
    aggregated.allRequiredRevisions.length === 0 &&
    aggregated.allOptionalRevisions.length > 0 &&
    aggregated.contradictions.length === 0 &&
    aggregated.unsupportedClaims.length === 0
  );
}

function prioritizeConcerns(concerns: readonly string[]): string[] {
  return dedupeNormalized([...concerns]).sort(compareIssuePriority);
}

function prioritizeRevisions(revisions: readonly string[]): string[] {
  return dedupeNormalized([...revisions]).sort(compareIssuePriority);
}

function compareIssuePriority(left: string, right: string): number {
  return issuePriority(right) - issuePriority(left);
}

function issuePriority(value: string): number {
  const normalized = value.toLowerCase();

  if (
    normalized.includes("contradiction") ||
    normalized.includes("contradicao") ||
    normalized.includes("violated_constraint") ||
    normalized.includes("violated constraint")
  ) {
    return 100;
  }

  if (
    normalized.includes("unsupported") ||
    normalized.includes("sem suporte") ||
    normalized.includes("closure") ||
    normalized.includes("conclusion") ||
    normalized.includes("conclusao")
  ) {
    return 80;
  }

  if (
    normalized.includes("sycophancy") ||
    normalized.includes("agreement") ||
    normalized.includes("over-agreement") ||
    normalized.includes("premise")
  ) {
    return 70;
  }

  if (
    normalized.includes("complete") ||
    normalized.includes("missing") ||
    normalized.includes("unresolved") ||
    normalized.includes("scenario")
  ) {
    return 60;
  }

  if (
    normalized.includes("language") ||
    normalized.includes("tone") ||
    normalized.includes("repetition")
  ) {
    return 40;
  }

  return 10;
}

export function getSynthesisDominantRisk(input: {
  readonly sycophancyRisk: CouncilRiskLevel;
  readonly logicRisk: CouncilRiskLevel;
  readonly evidenceRisk: CouncilRiskLevel;
  readonly completenessRisk: CouncilRiskLevel;
  readonly communicationRisk: CouncilRiskLevel;
  readonly advisorReports?: readonly CouncilAdvisorReport[];
}): CouncilRiskLevel {
  return maxRiskLevel([
    input.sycophancyRisk,
    input.logicRisk,
    input.evidenceRisk,
    input.completenessRisk,
    input.communicationRisk,
    ...(input.advisorReports ?? []).map((report) => report.risk),
  ]);
}

export function isSynthesisRiskAtLeast(
  risk: CouncilRiskLevel,
  minimum: CouncilRiskLevel,
): boolean {
  return riskWeight(risk) >= riskWeight(minimum);
}

export function getActionLabel(action: CouncilAction): string {
  return ACTION_LABELS[action] ?? action;
}