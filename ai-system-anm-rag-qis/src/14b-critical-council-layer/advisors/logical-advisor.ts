import type {
  CouncilAdvisorReport,
  CouncilInput,
  CouncilRiskLevel,
} from "../council-types";
import { scoreContradictionRisk } from "../scoring/contradiction-risk-scorer";
import {
  confidenceFromSignals,
  dedupeNormalized,
  isRiskAtLeast,
  maxRiskLevel,
  normalizeText,
  riskFromScore,
} from "./advisor-utils";
import { extractProblemResolutionCouncilSignals } from "../problem-resolution-signal-reader";

type LogicalConcernId =
  | "reasoning_closure_failed"
  | "unresolved_variables"
  | "violated_constraints"
  | "unsupported_conclusions"
  | "incomplete_case_analysis"
  | "explicit_contradiction_detected"
  | "premature_closure_detected"
  | "elimination_without_case_coverage"
  | "conditional_reasoning_without_cases"
  | "conclusion_without_inferential_bridge"
  | "constraint_language_present_but_not_preserved"
  | "absolute_conclusion_with_unresolved_reasoning"
  | "causal_claim_without_supporting_link"
  | "category_shift_signal"
  | "weak_logical_chain";

interface LogicalFinding {
  readonly id: LogicalConcernId | string;
  readonly risk: CouncilRiskLevel;
  readonly message: string;
  readonly requiredRevision?: string;
  readonly optionalRevision?: string;
}

interface ReasoningRiskSignal {
  readonly type: string;
  readonly severity?: CouncilRiskLevel;
  readonly message?: string;
}

interface ReasoningLogicSignals {
  readonly closurePassed: boolean | null;
  readonly missingVariables: string[];
  readonly violatedConstraints: string[];
  readonly unsupportedConclusions: string[];
  readonly unresolvedScenarios: string[];
  readonly contradictions: string[];
  readonly completionScore: number | null;
  readonly risks: ReasoningRiskSignal[];
  readonly missingProofObligations: string[];
  readonly formalHardFailures: string[];
}

const ADVISOR_ID = "logical";
const ADVISOR_NAME = "Logical Advisor";

const ELIMINATION_MARKERS = [
  "por eliminacao",
  "por exclusao",
  "eliminando",
  "sobra",
  "resta",
  "by elimination",
  "by exclusion",
  "remaining option",
];

const CASE_MARKERS = [
  "se",
  "caso",
  "cenario",
  "hipotese",
  "alternativa",
  "opcao",
  "possibilidade",
  "no primeiro caso",
  "no segundo caso",
  "if",
  "case",
  "scenario",
  "hypothesis",
  "alternative",
  "option",
  "possibility",
];

const CONDITIONAL_MARKERS = [
  "se",
  "caso",
  "quando",
  "desde que",
  "a menos que",
  "depende",
  "hipotese",
  "possibilidade",
  "if",
  "when",
  "unless",
  "depends",
  "hypothesis",
  "possibility",
];

const CONCLUSION_MARKERS = [
  "portanto",
  "logo",
  "assim",
  "desse modo",
  "conclui-se",
  "concluindo",
  "em conclusao",
  "resultado final",
  "therefore",
  "thus",
  "so",
  "in conclusion",
  "final answer",
];

const INFERENTIAL_BRIDGE_MARKERS = [
  "porque",
  "pois",
  "uma vez que",
  "considerando",
  "como",
  "decorre",
  "implica",
  "por isso",
  "com base",
  "a partir",
  "devido",
  "because",
  "since",
  "given that",
  "therefore",
  "implies",
  "based on",
  "due to",
];

const CONSTRAINT_MARKERS = [
  "deve",
  "nao pode",
  "precisa",
  "obrigatorio",
  "somente",
  "apenas",
  "todos",
  "todas",
  "nenhum",
  "cada",
  "must",
  "cannot",
  "should",
  "required",
  "only",
  "all",
  "none",
  "each",
];

const ABSOLUTE_CONCLUSION_MARKERS = [
  "com certeza",
  "sem duvida",
  "definitivamente",
  "obviamente",
  "sempre",
  "nunca",
  "necessariamente",
  "certainly",
  "undoubtedly",
  "definitely",
  "obviously",
  "always",
  "never",
  "necessarily",
];

const CAUSAL_MARKERS = [
  "causa",
  "causado",
  "gera",
  "provoca",
  "faz com que",
  "leva a",
  "resultado de",
  "cause",
  "causes",
  "caused",
  "leads to",
  "results in",
  "because of",
];

const CATEGORY_SHIFT_PATTERNS = [
  {
    from: "possibilidade",
    to: "certeza",
    markers: ["possivel", "talvez", "plausivel"],
    conclusionMarkers: ["com certeza", "necessariamente", "definitivamente"],
  },
  {
    from: "opiniao",
    to: "fato",
    markers: ["acho", "acredito", "me parece", "na minha visao"],
    conclusionMarkers: ["e fato", "esta comprovado", "sem duvida"],
  },
];

export function runLogicalAdvisor(
  input: CouncilInput,
): CouncilAdvisorReport {
  const draftAnswer = input.draftAnswer ?? "";
  const userInput = input.userInput ?? "";

  const reasoningSignals = extractReasoningLogicSignals(input);

  const contradictionRisk = scoreContradictionRisk({
    draftAnswer,
    knownContradictions: reasoningSignals.contradictions,
  });

  const contradictionFindings = buildContradictionFindings(
    contradictionRisk.contradictions ?? [],
    contradictionRisk.risk,
  );

  const findings = dedupeFindings([
    ...findReasoningStateIssues(reasoningSignals),
    ...contradictionFindings,
    ...findDraftLogicalIssues(userInput, draftAnswer, reasoningSignals),
  ]);

  const risk = maxRiskLevel([
    contradictionRisk.risk,
    ...findings.map((finding) => finding.risk),
  ]);

  const concerns = dedupeNormalized([
    ...findings.map((finding) => finding.id),
    ...(contradictionRisk.contradictions ?? []),
  ]);

  const requiredRevisions = dedupeNormalized(
    findings
      .map((finding) => finding.requiredRevision)
      .filter((revision): revision is string => Boolean(revision)),
  );

  const optionalRevisions = dedupeNormalized(
    findings
      .map((finding) => finding.optionalRevision)
      .filter((revision): revision is string => Boolean(revision)),
  );

  if (risk !== "low" && requiredRevisions.length === 0) {
    requiredRevisions.push(
      "Resolve logical inconsistencies, preserve the inferential chain and verify that the conclusion follows from the premises.",
    );
  }

  const hardSignals = findings.filter((finding) =>
    isRiskAtLeast(finding.risk, "high"),
  ).length;

  return {
    advisorId: ADVISOR_ID,
    advisorName: ADVISOR_NAME,
    passed: risk === "low",
    risk,
    concerns,
    strengths: risk === "low" ? buildStrengths(draftAnswer, reasoningSignals) : [],
    requiredRevisions,
    optionalRevisions,
    confidence: confidenceFromSignals(findings.length, hardSignals),
    contradictions: dedupeNormalized(contradictionRisk.contradictions ?? []),
  };
}

function extractReasoningLogicSignals(input: CouncilInput): ReasoningLogicSignals {
  const state =
    (input.problemResolutionState as unknown) ??
    (input.reasoningState as unknown) ??
    null;
  const problemResolution = extractProblemResolutionCouncilSignals(input);

  return {
    closurePassed:
      problemResolution.closurePassed ?? getNestedBoolean(state, ["closure", "passed"]),
    missingVariables: mergeStringArrays(
      getNestedStringArray(state, ["closure", "missingVariables"]),
      getNestedStringArray(state, ["missingVariables"]),
      getNestedStringArray(state, ["unresolvedVariables"]),
      problemResolution.missingVariables,
    ),
    violatedConstraints: mergeStringArrays(
      getNestedStringArray(state, ["closure", "violatedConstraints"]),
      getNestedStringArray(state, ["violatedConstraints"]),
      problemResolution.violatedConstraints,
    ),
    unsupportedConclusions: mergeStringArrays(
      getNestedStringArray(state, ["closure", "unsupportedConclusions"]),
      getNestedStringArray(state, ["unsupportedConclusions"]),
      problemResolution.unsupportedConclusions,
    ),
    unresolvedScenarios: mergeStringArrays(
      getNestedStringArray(state, ["closure", "unresolvedScenarios"]),
      getNestedStringArray(state, ["unresolvedScenarios"]),
      problemResolution.unresolvedScenarios,
    ),
    contradictions: mergeStringArrays(
      getNestedStringArray(state, ["closure", "contradictions"]),
      getNestedStringArray(state, ["contradictions"]),
      problemResolution.contradictions,
    ),
    completionScore:
      problemResolution.completionScore ??
      getNestedNumber(state, ["closure", "completionScore"]),
    risks: getReasoningRisks(state),
    missingProofObligations: problemResolution.missingProofObligations,
    formalHardFailures: problemResolution.hardFailureReasons,
  };
}

function findReasoningStateIssues(
  signals: ReasoningLogicSignals,
): LogicalFinding[] {
  const findings: LogicalFinding[] = [];

  if (signals.closurePassed === false) {
    findings.push({
      id: "reasoning_closure_failed",
      risk: "high",
      message:
        "The upstream problem-resolution layer reports that logical closure failed.",
      requiredRevision:
        "Resolve logical closure gaps before delivery. The answer must not merely start correctly; it must complete the reasoning chain.",
    });
  }

  if (signals.missingVariables.length > 0) {
    findings.push({
      id: "unresolved_variables",
      risk: "high",
      message:
        "The reasoning state contains variables that were not resolved.",
      requiredRevision:
        "Address every unresolved variable explicitly and connect each one to the final conclusion.",
    });
  }

  if (signals.violatedConstraints.length > 0) {
    findings.push({
      id: "violated_constraints",
      risk: "critical",
      message:
        "The reasoning state reports violated constraints from the user request.",
      requiredRevision:
        "Rebuild the answer while preserving all explicit constraints from the user request.",
    });
  }

  if (signals.unsupportedConclusions.length > 0) {
    findings.push({
      id: "unsupported_conclusions",
      risk: "high",
      message:
        "The reasoning state reports conclusions that are not supported by the premises.",
      requiredRevision:
        "Remove unsupported conclusions or provide a clear inferential justification for them.",
    });
  }

  if (signals.unresolvedScenarios.length > 0) {
    findings.push({
      id: "incomplete_case_analysis",
      risk: "high",
      message:
        "The reasoning state reports scenarios that were not analyzed or closed.",
      requiredRevision:
        "Cover all relevant scenarios before making the final claim.",
    });
  }

  if (signals.contradictions.length > 0) {
    findings.push({
      id: "explicit_contradiction_detected",
      risk: "critical",
      message:
        "The reasoning state reports explicit contradictions.",
      requiredRevision:
        "Resolve contradictions before approving the response.",
    });
  }

  if (signals.missingProofObligations.length > 0) {
    findings.push({
      id: "missing_proof_obligations",
      risk: "high",
      message:
        "The upstream problem-resolution layer reports proof obligations that were not satisfied.",
      requiredRevision:
        "Satisfy each proof obligation before approving the final answer.",
    });
  }

  if (signals.formalHardFailures.length > 0) {
    findings.push({
      id: "formal_problem_resolution_failure",
      risk: signals.violatedConstraints.length > 0 ? "critical" : "high",
      message:
        "The upstream problem-resolution layer reports formal failures that must affect the council decision.",
      requiredRevision:
        "Rebuild or revise the answer according to the formal problem-resolution failures before delivery.",
    });
  }

  const prematureClosureRisks = signals.risks.filter(
    (risk) => normalizeText(risk.type) === "premature_closure",
  );

  if (prematureClosureRisks.length > 0) {
    findings.push({
      id: "premature_closure_detected",
      risk: riskFromReasoningRisks(prematureClosureRisks, "high"),
      message:
        "The reasoning state indicates premature closure.",
      requiredRevision:
        "Do not claim that the issue is solved until all variables, constraints and scenarios have been processed.",
    });
  }

  if (
    typeof signals.completionScore === "number" &&
    Number.isFinite(signals.completionScore) &&
    signals.completionScore < 0.72
  ) {
    findings.push({
      id: "weak_logical_chain",
      risk: signals.completionScore < 0.5 ? "high" : "medium",
      message:
        "The upstream reasoning completion score is below the expected threshold.",
      requiredRevision:
        "Strengthen the reasoning chain until the conclusion is supported by all necessary intermediate steps.",
    });
  }

  return findings;
}

function findDraftLogicalIssues(
  userInput: string,
  draftAnswer: string,
  reasoningSignals: ReasoningLogicSignals,
): LogicalFinding[] {
  const findings: LogicalFinding[] = [];
  const normalizedUser = normalizeText(userInput);
  const normalizedDraft = normalizeText(draftAnswer);

  if (detectEliminationWithoutCoverage(normalizedDraft)) {
    findings.push({
      id: "elimination_without_case_coverage",
      risk: "medium",
      message:
        "The draft uses elimination language without enumerating enough cases or options.",
      requiredRevision:
        "If using elimination, enumerate the eliminated options and the remaining valid case.",
    });
  }

  if (
    userHasConditionalReasoningPressure(normalizedUser) &&
    !draftHasEnoughCaseCoverage(normalizedDraft)
  ) {
    findings.push({
      id: "conditional_reasoning_without_cases",
      risk: "medium",
      message:
        "The user request suggests conditional reasoning, but the draft does not cover cases sufficiently.",
      requiredRevision:
        "Identify the relevant cases or conditions and show how each affects the conclusion.",
    });
  }

  if (detectConclusionWithoutBridge(normalizedDraft)) {
    findings.push({
      id: "conclusion_without_inferential_bridge",
      risk: "medium",
      message:
        "The draft reaches a conclusion without enough inferential bridge language.",
      requiredRevision:
        "Add the missing inferential step that connects the premises to the conclusion.",
    });
  }

  if (
    userHasConstraintPressure(normalizedUser) &&
    draftHasWeakConstraintPreservation(normalizedUser, normalizedDraft)
  ) {
    findings.push({
      id: "constraint_language_present_but_not_preserved",
      risk: "medium",
      message:
        "The user request includes constraint language, but the draft may not preserve those constraints clearly.",
      requiredRevision:
        "Restate and preserve the relevant constraints while building the conclusion.",
    });
  }

  if (
    hasAbsoluteConclusion(normalizedDraft) &&
    hasUnresolvedReasoning(reasoningSignals)
  ) {
    findings.push({
      id: "absolute_conclusion_with_unresolved_reasoning",
      risk: "high",
      message:
        "The draft uses absolute conclusion language while reasoning remains unresolved.",
      requiredRevision:
        "Remove absolute certainty until unresolved variables, constraints and scenarios are closed.",
    });
  }

  if (detectCausalClaimWithoutSupport(normalizedDraft)) {
    findings.push({
      id: "causal_claim_without_supporting_link",
      risk: "medium",
      message:
        "The draft makes a causal claim without a clear supporting link.",
      optionalRevision:
        "Clarify the mechanism, premise or evidence that supports the causal relationship.",
    });
  }

  if (detectCategoryShift(normalizedDraft)) {
    findings.push({
      id: "category_shift_signal",
      risk: "medium",
      message:
        "The draft may shift from possibility or opinion to certainty without justification.",
      requiredRevision:
        "Preserve the correct epistemic category: possibility, inference, opinion and certainty must not be collapsed.",
    });
  }

  return findings;
}

function buildContradictionFindings(
  contradictions: readonly string[],
  risk: CouncilRiskLevel,
): LogicalFinding[] {
  if (contradictions.length === 0) {
    return [];
  }

  return [
    {
      id: "explicit_contradiction_detected",
      risk: isRiskAtLeast(risk, "high") ? risk : "high",
      message:
        "The contradiction scorer detected one or more contradictions.",
      requiredRevision:
        "Resolve the detected contradictions and ensure the final answer does not assert incompatible claims.",
    },
  ];
}

function detectEliminationWithoutCoverage(normalizedDraft: string): boolean {
  const usesElimination = ELIMINATION_MARKERS.some((marker) =>
    normalizedDraft.includes(normalizeText(marker)),
  );

  if (!usesElimination) {
    return false;
  }

  const caseMarkerCount = countMarkerHits(normalizedDraft, CASE_MARKERS);
  const numberedCaseCount = normalizedDraft.match(/\b\d+[.)]\s+/g)?.length ?? 0;
  const alternativeSeparators =
    normalizedDraft.match(/\b(ou|or|alternativa|option)\b/g)?.length ?? 0;

  return caseMarkerCount + numberedCaseCount + alternativeSeparators < 2;
}

function userHasConditionalReasoningPressure(normalizedUser: string): boolean {
  const conditionalMarkerCount = countMarkerHits(
    normalizedUser,
    CONDITIONAL_MARKERS,
  );

  const hasMultipleQuestionParts =
    (normalizedUser.match(/\?/g)?.length ?? 0) >= 2 ||
    (normalizedUser.match(/\b(e se|caso|se )\b/g)?.length ?? 0) >= 1;

  return conditionalMarkerCount >= 2 || hasMultipleQuestionParts;
}

function draftHasEnoughCaseCoverage(normalizedDraft: string): boolean {
  const caseMarkerCount = countMarkerHits(normalizedDraft, CASE_MARKERS);
  const numberedCaseCount = normalizedDraft.match(/\b\d+[.)]\s+/g)?.length ?? 0;

  return caseMarkerCount + numberedCaseCount >= 2;
}

function detectConclusionWithoutBridge(normalizedDraft: string): boolean {
  const conclusionCount = countMarkerHits(normalizedDraft, CONCLUSION_MARKERS);

  if (conclusionCount === 0) {
    return false;
  }

  const bridgeCount = countMarkerHits(normalizedDraft, INFERENTIAL_BRIDGE_MARKERS);
  const wordCount = countWords(normalizedDraft);

  if (wordCount < 45) {
    return false;
  }

  return bridgeCount === 0;
}

function userHasConstraintPressure(normalizedUser: string): boolean {
  return countMarkerHits(normalizedUser, CONSTRAINT_MARKERS) >= 2;
}

function draftHasWeakConstraintPreservation(
  normalizedUser: string,
  normalizedDraft: string,
): boolean {
  const userConstraintMarkers = CONSTRAINT_MARKERS.filter((marker) =>
    normalizedUser.includes(normalizeText(marker)),
  );

  if (userConstraintMarkers.length < 2) {
    return false;
  }

  const preservedMarkers = userConstraintMarkers.filter((marker) =>
    normalizedDraft.includes(normalizeText(marker)),
  );

  return preservedMarkers.length === 0 && countWords(normalizedDraft) > 60;
}

function hasAbsoluteConclusion(normalizedDraft: string): boolean {
  return ABSOLUTE_CONCLUSION_MARKERS.some((marker) =>
    normalizedDraft.includes(normalizeText(marker)),
  );
}

function hasUnresolvedReasoning(signals: ReasoningLogicSignals): boolean {
  return (
    signals.closurePassed === false ||
    signals.missingVariables.length > 0 ||
    signals.violatedConstraints.length > 0 ||
    signals.unsupportedConclusions.length > 0 ||
    signals.unresolvedScenarios.length > 0 ||
    signals.contradictions.length > 0
  );
}

function detectCausalClaimWithoutSupport(normalizedDraft: string): boolean {
  const causalCount = countMarkerHits(normalizedDraft, CAUSAL_MARKERS);

  if (causalCount === 0) {
    return false;
  }

  const bridgeCount = countMarkerHits(normalizedDraft, INFERENTIAL_BRIDGE_MARKERS);
  const evidenceLikeCount =
    countMarkerHits(normalizedDraft, [
      "evidencia",
      "dados",
      "fonte",
      "calculo",
      "codigo",
      "documento",
      "prova",
      "base",
      "evidence",
      "data",
      "source",
      "proof",
    ]) + bridgeCount;

  return evidenceLikeCount === 0;
}

function detectCategoryShift(normalizedDraft: string): boolean {
  return CATEGORY_SHIFT_PATTERNS.some((pattern) => {
    const hasInitialCategory = pattern.markers.some((marker) =>
      normalizedDraft.includes(normalizeText(marker)),
    );

    const hasStrongerConclusion = pattern.conclusionMarkers.some((marker) =>
      normalizedDraft.includes(normalizeText(marker)),
    );

    return hasInitialCategory && hasStrongerConclusion;
  });
}

function buildStrengths(
  draftAnswer: string,
  reasoningSignals: ReasoningLogicSignals,
): string[] {
  const strengths = [
    "Logical chain appears coherent and constraints are preserved.",
  ];

  if (reasoningSignals.closurePassed === true) {
    strengths.push("Upstream reasoning closure passed.");
  }

  if (draftHasEnoughCaseCoverage(normalizeText(draftAnswer))) {
    strengths.push("The draft includes visible case or scenario coverage.");
  }

  return dedupeNormalized(strengths);
}

function riskFromReasoningRisks(
  risks: readonly ReasoningRiskSignal[],
  fallback: CouncilRiskLevel,
): CouncilRiskLevel {
  const extractedRisks = risks
    .map((risk) => risk.severity)
    .filter((risk): risk is CouncilRiskLevel =>
      ["low", "medium", "high", "critical"].includes(String(risk)),
    );

  if (extractedRisks.length === 0) {
    return fallback;
  }

  return maxRiskLevel(extractedRisks);
}

function dedupeFindings(findings: readonly LogicalFinding[]): LogicalFinding[] {
  const byId = new Map<string, LogicalFinding>();

  for (const finding of findings) {
    const previous = byId.get(finding.id);

    if (!previous) {
      byId.set(finding.id, finding);
      continue;
    }

    byId.set(finding.id, {
      ...previous,
      risk: maxRiskLevel([previous.risk, finding.risk]),
      requiredRevision:
        previous.requiredRevision ?? finding.requiredRevision,
      optionalRevision:
        previous.optionalRevision ?? finding.optionalRevision,
    });
  }

  return Array.from(byId.values());
}

function countMarkerHits(
  normalizedText: string,
  markers: readonly string[],
): number {
  let count = 0;

  for (const marker of markers) {
    const normalizedMarker = normalizeText(marker);

    if (!normalizedMarker) {
      continue;
    }

    if (normalizedMarker.includes(" ")) {
      if (normalizedText.includes(normalizedMarker)) {
        count += 1;
      }

      continue;
    }

    const regex = new RegExp(`\\b${escapeRegExp(normalizedMarker)}\\b`, "g");
    count += normalizedText.match(regex)?.length ?? 0;
  }

  return count;
}

function countWords(normalizedText: string): number {
  return normalizedText
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter(Boolean).length;
}

function mergeStringArrays(...values: ReadonlyArray<readonly string[]>): string[] {
  return dedupeNormalized(values.flatMap((value) => value));
}

function getReasoningRisks(source: unknown): ReasoningRiskSignal[] {
  const risks = getNestedValue(source, ["risks"]);

  if (!Array.isArray(risks)) {
    return [];
  }

  return risks
    .filter(isRecord)
    .map((risk) => ({
      type: String(risk.type ?? ""),
      severity: normalizeRiskLevel(risk.severity),
      message:
        typeof risk.message === "string" ? risk.message : undefined,
    }))
    .filter((risk) => risk.type);
}

function normalizeRiskLevel(value: unknown): CouncilRiskLevel | undefined {
  const normalized = normalizeText(String(value ?? ""));

  if (["low", "medium", "high", "critical"].includes(normalized)) {
    return normalized as CouncilRiskLevel;
  }

  if (typeof value === "number") {
    return riskFromScore(value);
  }

  return undefined;
}

function getNestedStringArray(
  source: unknown,
  path: readonly string[],
): string[] {
  const value = getNestedValue(source, path);

  if (!Array.isArray(value)) {
    return [];
  }

  return dedupeNormalized(
    value
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean),
  );
}

function getNestedBoolean(
  source: unknown,
  path: readonly string[],
): boolean | null {
  const value = getNestedValue(source, path);

  return typeof value === "boolean" ? value : null;
}

function getNestedNumber(
  source: unknown,
  path: readonly string[],
): number | null {
  const value = getNestedValue(source, path);

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getNestedValue(source: unknown, path: readonly string[]): unknown {
  let current: unknown = source;

  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
