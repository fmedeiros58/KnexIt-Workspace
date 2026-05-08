import type {
  CouncilAction,
  CouncilAdvisorReport,
  CouncilAssessment,
  CouncilInput,
  CouncilRiskLevel,
  CouncilScoreResult,
  CouncilScoringState,
} from "./council-types";

import { runLogicalAdvisor } from "./advisors/logical-advisor";
import { runSkepticalAdvisor } from "./advisors/skeptical-advisor";
import { runEvidenceAdvisor } from "./advisors/evidence-advisor";
import { runCompletenessAdvisor } from "./advisors/completeness-advisor";
import { runAntiSycophancyAdvisor } from "./advisors/anti-sycophancy-advisor";
import { runCommunicationAdvisor } from "./advisors/communication-advisor";
import { runUserInterestAdvisor } from "./advisors/user-interest-advisor";
import { runSynthesisAdvisor } from "./advisors/synthesis-advisor";

import { scoreConfidenceCalibration } from "./scoring/confidence-calibration-scorer";
import { scoreSycophancyRisk } from "./scoring/sycophancy-risk-scorer";
import { scoreContradictionRisk } from "./scoring/contradiction-risk-scorer";
import { scoreCompletenessRisk } from "./scoring/completeness-risk-scorer";
import { scoreCriticalDepth } from "./scoring/critical-depth-scorer";
import { scoreUserBenefit } from "./scoring/user-benefit-scorer";
import { scoreAnswerIntegrity } from "./scoring/answer-integrity-scorer";

import { runCouncilSynthesis } from "./synthesis/council-synthesis-engine";

import { checkWeakCritique } from "./guards/weak-critique-guard";
import { checkPrematureApproval } from "./guards/premature-approval-guard";
import { checkUnsupportedConfidence } from "./guards/unsupported-confidence-guard";
import { decideFinalCouncilDelivery } from "./guards/final-delivery-blocker";
import { resolveCouncilAction } from "./guards/council-regeneration-policy";

import { buildCouncilRevisionPlan } from "./repair/council-revision-planner";
import { buildCouncilRewriteInstructions } from "./repair/council-rewrite-instructions-builder";
import {
  extractProblemResolutionCouncilSignals,
  type ProblemResolutionCouncilSignals,
} from "./problem-resolution-signal-reader";

interface ReasoningClosureSnapshot {
  readonly passed: boolean;
  readonly missingVariables: string[];
  readonly violatedConstraints: string[];
  readonly unresolvedScenarios: string[];
  readonly unsupportedConclusions: string[];
  readonly contradictions: string[];
}

interface ReasoningReportSnapshot {
  readonly missingObligations: string[];
}

interface ReasoningSnapshot {
  readonly state: unknown;
  readonly closure: ReasoningClosureSnapshot;
  readonly report: ReasoningReportSnapshot;
  readonly problemResolution: ProblemResolutionCouncilSignals;
  readonly unresolvedFrom14a: boolean;
}

interface AdvisorBundle {
  readonly logical: CouncilAdvisorReport;
  readonly skeptical: CouncilAdvisorReport;
  readonly evidence: CouncilAdvisorReport;
  readonly completeness: CouncilAdvisorReport;
  readonly antiSycophancy: CouncilAdvisorReport;
  readonly communication: CouncilAdvisorReport;
  readonly userInterest: CouncilAdvisorReport;
  readonly all: CouncilAdvisorReport[];
}

interface RiskBundle {
  readonly sycophancyRisk: CouncilRiskLevel;
  readonly logicRisk: CouncilRiskLevel;
  readonly evidenceRisk: CouncilRiskLevel;
  readonly completenessRisk: CouncilRiskLevel;
  readonly communicationRisk: CouncilRiskLevel;
}

const RISK_RANK: Record<CouncilRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const ACTION_RANK: Record<CouncilAction, number> = {
  approve: 0,
  send_with_caveat: 1,
  revise: 2,
  ask_clarification: 3,
  regenerate: 4,
  block_delivery: 5,
};

export function runCriticalCouncilOrchestrator(
  input: CouncilInput,
): CouncilAssessment {
  const normalizedInput = normalizeCouncilInput(input);
  const reasoning = buildReasoningSnapshot(normalizedInput);

  const advisors = runAdvisors(normalizedInput);

  const scoring = buildScoringState({
    input: normalizedInput,
    advisors,
    reasoning,
  });

  const risks = deriveRiskBundle(advisors, scoring);

  const provisionalAction = moreConservativeAction(
    resolveCouncilAction({
      sycophancyRisk: risks.sycophancyRisk,
      logicRisk: risks.logicRisk,
      evidenceRisk: risks.evidenceRisk,
      completenessRisk: risks.completenessRisk,
      communicationRisk: risks.communicationRisk,

      hasMissingCounterpoints: collectAdvisorStrings(
        advisors.all,
        "missingCounterpoints",
      ).length > 0,

      hasUnsupportedClaims: collectAdvisorStrings(
        advisors.all,
        "unsupportedClaims",
      ).length > 0,

      hasContradictions: collectAdvisorStrings(
        advisors.all,
        "contradictions",
      ).length > 0,

      hasRequiredRevisions: collectAdvisorStrings(
        advisors.all,
        "requiredRevisions",
      ).length > 0,

      hasCriticalAdvisorFailure: advisors.all.some(
        (report) => report.risk === "critical" || !report.passed,
      ),

      hasHighAdvisorFailure: advisors.all.some(
        (report) => report.risk === "high",
      ),

      hasWeakCritiqueSignal: scoring.criticalDepth.level !== "low",

      hasPrematureApprovalSignal:
        reasoning.problemResolution.riskTypes.includes("premature_closure"),

      hasUnsupportedConfidenceSignal:
        scoring.confidenceCalibration.level !== "low",
      hasDeliveryBlockerSignal:
        reasoning.problemResolution.requiredActionFloor === "block_delivery",
    }),
    reasoning.problemResolution.requiredActionFloor,
  );

  const baseAssessment = runSynthesisAdvisor({
    advisorReports: advisors.all,
    sycophancyRisk: risks.sycophancyRisk,
    logicRisk: risks.logicRisk,
    evidenceRisk: risks.evidenceRisk,
    completenessRisk: risks.completenessRisk,
    communicationRisk: risks.communicationRisk,
    proposedAction: provisionalAction,
  });

  const synthesis = runCouncilSynthesis({
    advisorReports: advisors.all,
    scores: scoring,
    reasoningClosurePassed: reasoning.closure.passed,
    unresolvedFrom14a: reasoning.unresolvedFrom14a,
    loopExhausted: false,
  });

  const weakCritiqueGuard = checkWeakCritique(advisors.all, synthesis);

  const prematureApprovalGuard = checkPrematureApproval({
    baseAssessment,
    synthesis,
    unresolvedFrom14a: reasoning.unresolvedFrom14a,
  });

  const unsupportedConfidenceGuard = checkUnsupportedConfidence({
    draftAnswer: normalizedInput.draftAnswer,
    advisorReports: advisors.all,
    scores: scoring,
  });

  const revisionPlan = buildCouncilRevisionPlan(synthesis, normalizedInput);
  const rewriteInstruction = buildCouncilRewriteInstructions(revisionPlan);

  const deliveryDecision = decideFinalCouncilDelivery({
    baseAssessment,
    synthesis,
    weakCritiqueGuard,
    prematureApprovalGuard,
    unsupportedConfidenceGuard,
    revisionPlan,
    problemResolution: reasoning.problemResolution,
    userGoalSatisfied: isUserGoalSatisfied(
      normalizedInput.userInput,
      normalizedInput.draftAnswer,
    ),
  });

  const finalAction = deliveryDecision.requiredAction;

  const approved = isDeliverableFinalAction(
    finalAction,
    deliveryDecision.canDeliver,
  );

  const mainConcerns = buildMainConcerns({
    baseAssessment,
    synthesis,
    deliveryDecision,
    weakCritiqueGuard,
    prematureApprovalGuard,
    unsupportedConfidenceGuard,
  });

  const requiredRevisions = buildRequiredRevisions({
    baseAssessment,
    revisionPlan,
    weakCritiqueGuard,
    unsupportedConfidenceGuard,
    deliveryDecision,
  });

  const optionalRevisions = dedupe([
    ...(baseAssessment.optionalRevisions ?? []),
    ...(synthesis.finalRecommendation.optionalRevisions ?? []),
  ]);

  const finalRecommendation = {
    ...synthesis.finalRecommendation,
    action: finalAction,
    approved,
    requiredRevisions:
      finalAction === "approve" || finalAction === "send_with_caveat"
        ? []
        : requiredRevisions,
    optionalRevisions,
    deliveryBlocked: !deliveryDecision.canDeliver,
  };

  return {
    approved,
    action: finalAction,

    sycophancyRisk: risks.sycophancyRisk,
    logicRisk: risks.logicRisk,
    evidenceRisk: risks.evidenceRisk,
    completenessRisk: risks.completenessRisk,
    communicationRisk: risks.communicationRisk,

    mainConcerns,

    missingCounterpoints: dedupe([
      ...(baseAssessment.missingCounterpoints ?? []),
      ...collectAdvisorStrings(advisors.all, "missingCounterpoints"),
    ]),

    unsupportedClaims: dedupe([
      ...(baseAssessment.unsupportedClaims ?? []),
      ...collectAdvisorStrings(advisors.all, "unsupportedClaims"),
    ]),

    contradictions: dedupe([
      ...(baseAssessment.contradictions ?? []),
      ...collectAdvisorStrings(advisors.all, "contradictions"),
    ]),

    overAgreementSignals: dedupe([
      ...(baseAssessment.overAgreementSignals ?? []),
      ...collectAdvisorStrings(advisors.all, "overAgreementSignals"),
    ]),

    requiredRevisions,
    optionalRevisions,

    synthesisInstruction: buildSynthesisInstruction(
      baseAssessment.synthesisInstruction,
      synthesis.synthesisSummary,
      rewriteInstruction,
    ),

    advisorReports: advisors.all,
    scoring,
    synthesis,
    revisionPlan,
    rewriteInstruction,
    weakCritiqueGuard,
    prematureApprovalGuard,
    unsupportedConfidenceGuard,
    deliveryDecision,
    finalRecommendation,
  };
}

function normalizeCouncilInput(input: CouncilInput): CouncilInput {
  const reasoningState = input.problemResolutionState || input.reasoningState || null;

  return {
    ...input,
    userInput: String(input.userInput ?? ""),
    draftAnswer: String(input.draftAnswer ?? ""),
    reasoningState: reasoningState as CouncilInput["reasoningState"],
    problemResolutionState:
      reasoningState as CouncilInput["problemResolutionState"],
    problemResolutionArtifact: input.problemResolutionArtifact ?? null,
    retrievedEvidence: Array.isArray(input.retrievedEvidence)
      ? input.retrievedEvidence
      : [],
    retrievedSources: Array.isArray(input.retrievedSources)
      ? input.retrievedSources
      : [],
  };
}

function buildReasoningSnapshot(input: CouncilInput): ReasoningSnapshot {
  const state = input.problemResolutionState || input.reasoningState || null;
  const problemResolution = extractProblemResolutionCouncilSignals(input);

  const closure: ReasoningClosureSnapshot = {
    passed:
      problemResolution.closurePassed ??
      getNestedBoolean(state, ["closure", "passed"], true),
    missingVariables: dedupe([
      ...getNestedStringArray(state, ["closure", "missingVariables"]),
      ...problemResolution.missingVariables,
    ]),
    violatedConstraints: dedupe([
      ...getNestedStringArray(state, ["closure", "violatedConstraints"]),
      ...problemResolution.violatedConstraints,
    ]),
    unresolvedScenarios: dedupe([
      ...getNestedStringArray(state, ["closure", "unresolvedScenarios"]),
      ...problemResolution.unresolvedScenarios,
    ]),
    unsupportedConclusions: dedupe([
      ...getNestedStringArray(state, ["closure", "unsupportedConclusions"]),
      ...problemResolution.unsupportedConclusions,
    ]),
    contradictions: dedupe([
      ...getNestedStringArray(state, ["closure", "contradictions"]),
      ...problemResolution.contradictions,
    ]),
  };

  const report: ReasoningReportSnapshot = {
    missingObligations: dedupe([
      ...getNestedStringArray(state, ["report", "missingObligations"]),
      ...problemResolution.missingObligations,
      ...problemResolution.missingProofObligations.map(
        (obligation) => `proof_obligation:${obligation}`,
      ),
    ]),
  };

  const unresolvedFrom14a =
    problemResolution.hardFailureReasons.length > 0 ||
    !closure.passed ||
    closure.missingVariables.length > 0 ||
    closure.violatedConstraints.length > 0 ||
    closure.unresolvedScenarios.length > 0 ||
    closure.unsupportedConclusions.length > 0 ||
    closure.contradictions.length > 0 ||
    report.missingObligations.length > 0;

  return {
    state,
    closure,
    report,
    problemResolution,
    unresolvedFrom14a,
  };
}

function runAdvisors(input: CouncilInput): AdvisorBundle {
  const logical = runLogicalAdvisor(input);
  const skeptical = runSkepticalAdvisor(input);
  const evidence = runEvidenceAdvisor(input);
  const completeness = runCompletenessAdvisor(input);
  const antiSycophancy = runAntiSycophancyAdvisor(input);
  const communication = runCommunicationAdvisor(input);
  const userInterest = runUserInterestAdvisor(input);

  return {
    logical,
    skeptical,
    evidence,
    completeness,
    antiSycophancy,
    communication,
    userInterest,
    all: [
      logical,
      skeptical,
      evidence,
      completeness,
      antiSycophancy,
      communication,
      userInterest,
    ],
  };
}

function buildScoringState(input: {
  readonly input: CouncilInput;
  readonly advisors: AdvisorBundle;
  readonly reasoning: ReasoningSnapshot;
}): CouncilScoringState {
  const { input: councilInput, advisors, reasoning } = input;

  const hasEvidence =
    (councilInput.retrievedEvidence ?? []).length > 0 ||
    (councilInput.retrievedSources ?? []).length > 0;

  const sycophancyScore = scoreSycophancyRisk({
    userInput: councilInput.userInput,
    draftAnswer: councilInput.draftAnswer,
  });

  const contradictionScore = scoreContradictionRisk({
    draftAnswer: councilInput.draftAnswer,
    knownContradictions: reasoning.closure.contradictions,
  });

  const completenessScore = scoreCompletenessRisk({
    missingVariables: reasoning.closure.missingVariables,
    missingObligations: reasoning.report.missingObligations,
    unresolvedScenarios: reasoning.closure.unresolvedScenarios,
    violatedConstraints: reasoning.closure.violatedConstraints,
    unsupportedConclusions: reasoning.closure.unsupportedConclusions,
    closurePassed: reasoning.closure.passed,
  });

  const advisorRequiredRevisions = collectAdvisorStrings(
    advisors.all,
    "requiredRevisions",
  );

  const advisorUnsupportedClaims = collectAdvisorStrings(
    advisors.all,
    "unsupportedClaims",
  );

  const advisorContradictions = collectAdvisorStrings(
    advisors.all,
    "contradictions",
  );

  const confidenceCalibration = scoreConfidenceCalibration({
    draftAnswer: councilInput.draftAnswer,
    hasEvidence,
    hasStrongLogicalSupport:
      advisors.logical.risk === "low" &&
      contradictionScore.risk === "low" &&
      reasoning.closure.passed,
    hasUnsupportedClaims: advisorUnsupportedClaims.length > 0,
    hasContradictions: advisorContradictions.length > 0,
    hasRequiredRevisions: advisorRequiredRevisions.length > 0,
    evidenceRisk: advisors.evidence.risk,
    logicRisk: advisors.logical.risk,
    completenessRisk: advisors.completeness.risk,
  });

  return {
    sycophancy: {
      score: sycophancyScore.score,
      level: sycophancyScore.risk,
      reasons: sycophancyScore.signals,
    },

    evidence: scoreFromRisk(advisors.evidence.risk, advisors.evidence.concerns),

    contradiction: {
      score: contradictionScore.score,
      level: contradictionScore.risk,
      reasons: contradictionScore.contradictions,
    },

    completeness: {
      score: completenessScore.score,
      level: completenessScore.risk,
      reasons: completenessScore.concerns,
    },

    confidenceCalibration: {
      score: confidenceCalibration.score,
      level: normalizeRiskLevel(
        getUnknownProperty(confidenceCalibration, "level") ??
          confidenceCalibration.risk,
      ),
      reasons: getScoreReasons(confidenceCalibration),
    },

    criticalDepth: scoreCriticalDepth({
      advisorReports: advisors.all,
      draftAnswer: councilInput.draftAnswer,
      userInput: councilInput.userInput,
    }),

    userBenefit: scoreUserBenefit({
      councilInput,
      advisorReports: advisors.all,
    }),

    answerIntegrity: scoreAnswerIntegrity({
      councilInput,
      advisorReports: advisors.all,
    }),
  };
}

function deriveRiskBundle(
  advisors: AdvisorBundle,
  scoring: CouncilScoringState,
): RiskBundle {
  const sycophancyRisk = maxRisk(
    advisors.antiSycophancy.risk,
    scoring.sycophancy.level,
  );

  const logicRisk = maxRisk(
    advisors.logical.risk,
    scoring.contradiction.level,
  );

  const evidenceRisk = maxRisk(
    maxRisk(advisors.evidence.risk, scoring.evidence.level),
    scoring.confidenceCalibration.level === "critical"
      ? "high"
      : scoring.confidenceCalibration.level,
  );

  const completenessRisk = maxRisk(
    maxRisk(advisors.completeness.risk, scoring.completeness.level),
    scoring.answerIntegrity.level === "critical" ? "high" : "low",
  );

  const communicationRisk = maxRisk(
    advisors.communication.risk,
    scoring.answerIntegrity.level === "critical" ? "high" : "low",
  );

  return {
    sycophancyRisk,
    logicRisk,
    evidenceRisk,
    completenessRisk,
    communicationRisk,
  };
}

function scoreFromRisk(
  risk: CouncilRiskLevel,
  reasons: readonly string[],
): CouncilScoreResult {
  const value =
    risk === "critical"
      ? 0.95
      : risk === "high"
        ? 0.78
        : risk === "medium"
          ? 0.52
          : 0.18;

  return {
    score: value,
    level: risk,
    reasons: dedupe(reasons),
  };
}

function buildMainConcerns(input: {
  readonly baseAssessment: ReturnType<typeof runSynthesisAdvisor>;
  readonly synthesis: ReturnType<typeof runCouncilSynthesis>;
  readonly deliveryDecision: CouncilAssessment["deliveryDecision"];
  readonly weakCritiqueGuard: CouncilAssessment["weakCritiqueGuard"];
  readonly prematureApprovalGuard: CouncilAssessment["prematureApprovalGuard"];
  readonly unsupportedConfidenceGuard: CouncilAssessment["unsupportedConfidenceGuard"];
}): string[] {
  return dedupe([
    ...(input.baseAssessment.mainConcerns ?? []),
    ...(input.synthesis.disagreementResolution.dominantConcerns ?? []),
    ...(input.synthesis.finalRecommendation.reasons ?? []),
    ...(input.deliveryDecision.reasons ?? []),
    ...(input.weakCritiqueGuard.weakCritiqueSignals ?? []),
    ...(input.prematureApprovalGuard.blockedReasons ?? []),
    ...(input.unsupportedConfidenceGuard.overconfidenceSignals ?? []),
    ...(input.unsupportedConfidenceGuard.underconfidenceSignals ?? []),
  ]);
}

function buildRequiredRevisions(input: {
  readonly baseAssessment: ReturnType<typeof runSynthesisAdvisor>;
  readonly revisionPlan: CouncilAssessment["revisionPlan"];
  readonly weakCritiqueGuard: CouncilAssessment["weakCritiqueGuard"];
  readonly unsupportedConfidenceGuard: CouncilAssessment["unsupportedConfidenceGuard"];
  readonly deliveryDecision: CouncilAssessment["deliveryDecision"];
}): string[] {
  const plan = input.revisionPlan;
  const includePlanInstructions = Boolean(
    plan.revisionRequired || plan.regenerationRequired,
  );

  return dedupe([
    ...(input.baseAssessment.requiredRevisions ?? []),
    ...(plan.revisionRequired ? plan.rewriteInstructions ?? [] : []),
    ...(plan.regenerationRequired ? plan.revisionGoals ?? [] : []),
    ...(includePlanInstructions ? plan.logicInstructions ?? [] : []),
    ...(includePlanInstructions ? plan.evidenceInstructions ?? [] : []),
    ...(includePlanInstructions ? plan.antiSycophancyInstructions ?? [] : []),
    ...(includePlanInstructions ? plan.toneInstructions ?? [] : []),
    ...(input.unsupportedConfidenceGuard.requiredCalibration ?? []),
    ...(input.weakCritiqueGuard.requiredSpecificity ?? []),
    ...(input.deliveryDecision.canDeliver
      ? []
      : input.deliveryDecision.reasons ?? []),
  ]);
}

function buildSynthesisInstruction(
  baseInstruction: string,
  synthesisSummary: string,
  rewriteInstruction: string,
): string {
  return dedupe([baseInstruction, synthesisSummary, rewriteInstruction]).join(" ");
}

function isDeliverableFinalAction(
  action: CouncilAction,
  canDeliver: boolean,
): boolean {
  return canDeliver && (action === "approve" || action === "send_with_caveat");
}

function isUserGoalSatisfied(userInput: string, draftAnswer: string): boolean {
  const userTerms = extractSalientTerms(userInput);

  if (userTerms.length === 0) {
    return true;
  }

  const normalizedDraft = normalizeText(draftAnswer);
  const matchedTerms = userTerms.filter((term) => normalizedDraft.includes(term));

  return matchedTerms.length / Math.max(1, userTerms.length) >= 0.18;
}

function extractSalientTerms(text: string): string[] {
  const stopwords = new Set([
    "preciso",
    "quero",
    "agora",
    "isso",
    "esse",
    "essa",
    "para",
    "como",
    "voce",
    "você",
    "fazer",
    "criar",
    "melhorar",
    "codigo",
    "código",
    "arquivo",
    "resposta",
    "texto",
    "seguinte",
    "minha",
    "meu",
    "the",
    "and",
    "that",
    "this",
    "need",
    "want",
    "answer",
    "code",
  ]);

  return dedupe(
    normalizeText(text)
      .split(/\s+/g)
      .map((term) => term.trim())
      .filter((term) => term.length >= 4 && !stopwords.has(term)),
  ).slice(0, 18);
}

function collectAdvisorStrings(
  advisorReports: readonly CouncilAdvisorReport[],
  key:
    | "concerns"
    | "requiredRevisions"
    | "optionalRevisions"
    | "missingCounterpoints"
    | "unsupportedClaims"
    | "contradictions"
    | "overAgreementSignals",
): string[] {
  return dedupe(
    advisorReports.flatMap((report) => {
      const value = report[key];

      return Array.isArray(value) ? value : [];
    }),
  );
}

function getScoreReasons(score: unknown): string[] {
  return dedupe([
    ...getStringArrayProperty(score, "reasons"),
    ...getStringArrayProperty(score, "notes"),
  ]);
}

function normalizeRiskLevel(value: unknown): CouncilRiskLevel {
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

function maxRisk(
  left: CouncilRiskLevel,
  right: CouncilRiskLevel,
): CouncilRiskLevel {
  return RISK_RANK[left] >= RISK_RANK[right] ? left : right;
}

function moreConservativeAction(
  left: CouncilAction,
  right: CouncilAction | null,
): CouncilAction {
  if (!right) {
    return left;
  }

  return ACTION_RANK[right] > ACTION_RANK[left] ? right : left;
}

function getNestedStringArray(
  source: unknown,
  path: readonly string[],
): string[] {
  let current: unknown = source;

  for (const segment of path) {
    if (!isRecord(current)) {
      return [];
    }

    current = current[segment];
  }

  return toStringArray(current);
}

function getNestedBoolean(
  source: unknown,
  path: readonly string[],
  fallback: boolean,
): boolean {
  let current: unknown = source;

  for (const segment of path) {
    if (!isRecord(current)) {
      return fallback;
    }

    current = current[segment];
  }

  return typeof current === "boolean" ? current : fallback;
}

function getStringArrayProperty(source: unknown, key: string): string[] {
  if (!isRecord(source)) {
    return [];
  }

  return toStringArray(source[key]);
}

function getUnknownProperty(source: unknown, key: string): unknown {
  if (!isRecord(source)) {
    return undefined;
  }

  return source[key];
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

function normalizeText(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupe(values: ReadonlyArray<string>): string[] {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
