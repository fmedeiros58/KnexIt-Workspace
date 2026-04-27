import type {
  CouncilAction,
  CouncilAssessment,
  CouncilInput,
  CouncilRiskLevel,
  CouncilSecondPassResult,
} from "../council-types";

interface SecondPassInput {
  readonly originalAssessment: CouncilAssessment;
  readonly revisedAssessment: CouncilAssessment;
  readonly revisedDraft: string;
  readonly councilInput: CouncilInput;
}

interface DeliveryDecisionLike {
  readonly canDeliver: boolean | null;
  readonly requiredAction: CouncilAction | null;
  readonly reasons: string[];
}

interface AssessmentSnapshot {
  readonly action: CouncilAction;
  readonly approved: boolean;
  readonly canDeliver: boolean | null;
  readonly deliveryRequiredAction: CouncilAction | null;
  readonly deliveryReasons: string[];

  readonly logicRisk: CouncilRiskLevel;
  readonly evidenceRisk: CouncilRiskLevel;
  readonly completenessRisk: CouncilRiskLevel;
  readonly sycophancyRisk: CouncilRiskLevel;
  readonly communicationRisk: CouncilRiskLevel;

  readonly mainConcerns: string[];
  readonly requiredRevisions: string[];
  readonly contradictions: string[];
  readonly unsupportedClaims: string[];
  readonly missingCounterpoints: string[];
  readonly overAgreementSignals: string[];

  readonly allIssues: string[];
  readonly hardIssues: string[];
}

const ACTION_PRIORITY: Record<CouncilAction, number> = {
  approve: 0,
  send_with_caveat: 1,
  revise: 2,
  ask_clarification: 3,
  regenerate: 4,
  block_delivery: 5,
};

const RISK_WEIGHT: Record<CouncilRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function runCouncilSecondPassCheck(
  input: SecondPassInput,
): CouncilSecondPassResult {
  const original = buildAssessmentSnapshot(input.originalAssessment);
  const revised = buildAssessmentSnapshot(input.revisedAssessment);

  const draftQualityIssues = findDraftQualityIssues({
    revisedDraft: input.revisedDraft,
    councilInput: input.councilInput,
  });

  const revisedIssuesWithDraftQuality = dedupe([
    ...revised.allIssues,
    ...draftQualityIssues,
  ]);

  const resolvedIssues = findResolvedIssues(
    original.allIssues,
    revisedIssuesWithDraftQuality,
  );

  const remainingIssues = dedupe(revisedIssuesWithDraftQuality);
  const newIssues = findNewIssues(original.allIssues, revisedIssuesWithDraftQuality);

  const blockingReasons = findBlockingReasons(revised, draftQualityIssues);
  const hardRemainingReasons = findHardRemainingReasons(revised, draftQualityIssues);

  const requiresAnotherPass = shouldRequireAnotherPass({
    revised,
    blockingReasons,
    hardRemainingReasons,
    remainingIssues,
    newIssues,
  });

  const finalAction = resolveFinalAction({
    revised,
    blockingReasons,
    hardRemainingReasons,
    requiresAnotherPass,
  });

  const passed = shouldPassSecondCheck({
    original,
    revised,
    blockingReasons,
    hardRemainingReasons,
    requiresAnotherPass,
    resolvedIssues,
    remainingIssues,
    newIssues,
    finalAction,
  });

  return {
    passed,
    remainingIssues,
    resolvedIssues,
    requiresAnotherPass,
    finalAction,
  };
}

function buildAssessmentSnapshot(
  assessment: CouncilAssessment,
): AssessmentSnapshot {
  const action = normalizeAction(getUnknownProperty(assessment, "action"));
  const deliveryDecision = getDeliveryDecision(assessment);

  const logicRisk = normalizeRiskLevel(getUnknownProperty(assessment, "logicRisk"));
  const evidenceRisk = normalizeRiskLevel(
    getUnknownProperty(assessment, "evidenceRisk"),
  );
  const completenessRisk = normalizeRiskLevel(
    getUnknownProperty(assessment, "completenessRisk"),
  );
  const sycophancyRisk = normalizeRiskLevel(
    getUnknownProperty(assessment, "sycophancyRisk"),
  );
  const communicationRisk = normalizeRiskLevel(
    getUnknownProperty(assessment, "communicationRisk"),
  );

  const mainConcerns = getStringArrayProperty(assessment, "mainConcerns");
  const requiredRevisions = getStringArrayProperty(
    assessment,
    "requiredRevisions",
  );
  const contradictions = getStringArrayProperty(assessment, "contradictions");
  const unsupportedClaims = getStringArrayProperty(
    assessment,
    "unsupportedClaims",
  );
  const missingCounterpoints = getStringArrayProperty(
    assessment,
    "missingCounterpoints",
  );
  const overAgreementSignals = getStringArrayProperty(
    assessment,
    "overAgreementSignals",
  );

  const riskIssues = buildRiskIssues({
    logicRisk,
    evidenceRisk,
    completenessRisk,
    sycophancyRisk,
    communicationRisk,
  });

  const allIssues = dedupe([
    ...mainConcerns.map((issue) => `concern:${issue}`),
    ...requiredRevisions.map((issue) => `required_revision:${issue}`),
    ...contradictions.map((issue) => `contradiction:${issue}`),
    ...unsupportedClaims.map((issue) => `unsupported_claim:${issue}`),
    ...missingCounterpoints.map((issue) => `missing_counterpoint:${issue}`),
    ...overAgreementSignals.map((issue) => `over_agreement:${issue}`),
    ...deliveryDecision.reasons.map((issue) => `delivery_reason:${issue}`),
    ...riskIssues,
  ]);

  const hardIssues = dedupe([
    ...contradictions.map((issue) => `contradiction:${issue}`),
    ...buildHardRiskIssues({
      logicRisk,
      evidenceRisk,
      completenessRisk,
      sycophancyRisk,
      communicationRisk,
    }),
    ...(deliveryDecision.canDeliver === false
      ? deliveryDecision.reasons.map((issue) => `delivery_block:${issue}`)
      : []),
  ]);

  return {
    action,
    approved: getBooleanProperty(assessment, "approved") ?? action === "approve",
    canDeliver: deliveryDecision.canDeliver,
    deliveryRequiredAction: deliveryDecision.requiredAction,
    deliveryReasons: deliveryDecision.reasons,

    logicRisk,
    evidenceRisk,
    completenessRisk,
    sycophancyRisk,
    communicationRisk,

    mainConcerns,
    requiredRevisions,
    contradictions,
    unsupportedClaims,
    missingCounterpoints,
    overAgreementSignals,

    allIssues,
    hardIssues,
  };
}

function findResolvedIssues(
  originalIssues: readonly string[],
  revisedIssues: readonly string[],
): string[] {
  const revisedKeys = new Set(revisedIssues.map(normalizeIssueKey));

  return dedupe(
    originalIssues.filter((issue) => !revisedKeys.has(normalizeIssueKey(issue))),
  );
}

function findNewIssues(
  originalIssues: readonly string[],
  revisedIssues: readonly string[],
): string[] {
  const originalKeys = new Set(originalIssues.map(normalizeIssueKey));

  return dedupe(
    revisedIssues.filter((issue) => !originalKeys.has(normalizeIssueKey(issue))),
  );
}

function findBlockingReasons(
  revised: AssessmentSnapshot,
  draftQualityIssues: readonly string[],
): string[] {
  const reasons: string[] = [];

  if (revised.action === "block_delivery") {
    reasons.push("revised_action_blocks_delivery");
  }

  if (revised.deliveryRequiredAction === "block_delivery") {
    reasons.push("delivery_decision_requires_block_delivery");
  }

  if (revised.canDeliver === false && revised.action === "block_delivery") {
    reasons.push("delivery_decision_cannot_deliver_blocked_action");
  }

  if (revised.contradictions.length > 0) {
    reasons.push("unresolved_contradictions_after_revision");
  }

  if (revised.logicRisk === "critical") {
    reasons.push("critical_logic_risk_after_revision");
  }

  if (revised.completenessRisk === "critical") {
    reasons.push("critical_completeness_risk_after_revision");
  }

  if (draftQualityIssues.includes("empty_or_near_empty_revised_draft")) {
    reasons.push("empty_or_near_empty_revised_draft");
  }

  return dedupe(reasons);
}

function findHardRemainingReasons(
  revised: AssessmentSnapshot,
  draftQualityIssues: readonly string[],
): string[] {
  const reasons: string[] = [];

  if (revised.logicRisk === "high") {
    reasons.push("high_logic_risk_after_revision");
  }

  if (revised.completenessRisk === "high") {
    reasons.push("high_completeness_risk_after_revision");
  }

  if (revised.evidenceRisk === "critical") {
    reasons.push("critical_evidence_risk_after_revision");
  }

  if (revised.deliveryRequiredAction === "regenerate") {
    reasons.push("delivery_decision_requires_regeneration");
  }

  if (revised.deliveryRequiredAction === "revise") {
    reasons.push("delivery_decision_requires_revision");
  }

  if (revised.canDeliver === false && revised.action !== "block_delivery") {
    reasons.push("delivery_decision_still_cannot_deliver");
  }

  if (draftQualityIssues.includes("revised_draft_not_aligned_with_user_request")) {
    reasons.push("revised_draft_not_aligned_with_user_request");
  }

  return dedupe(reasons);
}

function shouldRequireAnotherPass(input: {
  readonly revised: AssessmentSnapshot;
  readonly blockingReasons: readonly string[];
  readonly hardRemainingReasons: readonly string[];
  readonly remainingIssues: readonly string[];
  readonly newIssues: readonly string[];
}): boolean {
  if (input.blockingReasons.length > 0) {
    return false;
  }

  if (input.hardRemainingReasons.length > 0) {
    return true;
  }

  if (input.revised.action === "revise" || input.revised.action === "regenerate") {
    return true;
  }

  if (
    input.revised.deliveryRequiredAction === "revise" ||
    input.revised.deliveryRequiredAction === "regenerate"
  ) {
    return true;
  }

  const newHardIssue = input.newIssues.some((issue) =>
    /critical|high|contradiction|block|regenerate/i.test(issue),
  );

  if (newHardIssue) {
    return true;
  }

  return false;
}

function resolveFinalAction(input: {
  readonly revised: AssessmentSnapshot;
  readonly blockingReasons: readonly string[];
  readonly hardRemainingReasons: readonly string[];
  readonly requiresAnotherPass: boolean;
}): CouncilAction {
  if (input.blockingReasons.length > 0) {
    return "block_delivery";
  }

  if (
    input.hardRemainingReasons.some((reason) =>
      /logic|completeness|regeneration|cannot_deliver/i.test(reason),
    )
  ) {
    return "regenerate";
  }

  if (input.requiresAnotherPass) {
    return moreConservativeAction(input.revised.action, "revise");
  }

  if (input.revised.unsupportedClaims.length > 0) {
    return "send_with_caveat";
  }

  if (input.revised.missingCounterpoints.length > 0) {
    return "send_with_caveat";
  }

  if (input.revised.deliveryRequiredAction) {
    return input.revised.deliveryRequiredAction;
  }

  if (input.revised.action === "send_with_caveat") {
    return "send_with_caveat";
  }

  return "approve";
}

function shouldPassSecondCheck(input: {
  readonly original: AssessmentSnapshot;
  readonly revised: AssessmentSnapshot;
  readonly blockingReasons: readonly string[];
  readonly hardRemainingReasons: readonly string[];
  readonly requiresAnotherPass: boolean;
  readonly resolvedIssues: readonly string[];
  readonly remainingIssues: readonly string[];
  readonly newIssues: readonly string[];
  readonly finalAction: CouncilAction;
}): boolean {
  if (input.blockingReasons.length > 0) {
    return false;
  }

  if (input.hardRemainingReasons.length > 0) {
    return false;
  }

  if (input.requiresAnotherPass) {
    return false;
  }

  if (input.finalAction === "block_delivery") {
    return false;
  }

  if (input.finalAction === "revise" || input.finalAction === "regenerate") {
    return false;
  }

  if (input.revised.canDeliver === false) {
    return false;
  }

  const originalHadIssues = input.original.allIssues.length > 0;
  const madeProgress =
    !originalHadIssues || input.resolvedIssues.length > 0 || input.remainingIssues.length === 0;

  if (!madeProgress) {
    return false;
  }

  const remainingHardIssue = input.remainingIssues.some((issue) =>
    /critical|high_logic|high_completeness|contradiction|block_delivery/i.test(
      issue,
    ),
  );

  if (remainingHardIssue) {
    return false;
  }

  const newHardIssue = input.newIssues.some((issue) =>
    /critical|contradiction|block_delivery/i.test(issue),
  );

  if (newHardIssue) {
    return false;
  }

  return input.finalAction === "approve" || input.finalAction === "send_with_caveat";
}

function findDraftQualityIssues(input: {
  readonly revisedDraft: string;
  readonly councilInput: CouncilInput;
}): string[] {
  const issues: string[] = [];
  const draft = normalizeText(input.revisedDraft);
  const userInput = normalizeText(input.councilInput.userInput ?? "");

  if (draft.length < 20) {
    issues.push("empty_or_near_empty_revised_draft");
    return issues;
  }

  if (userInput.length > 0 && !hasAnyUserGoalSignalInDraft(userInput, draft)) {
    issues.push("revised_draft_not_aligned_with_user_request");
  }

  if (requiresCodeLikeAnswer(userInput) && !looksLikeCodeAnswer(input.revisedDraft)) {
    issues.push("requested_code_not_present_in_revised_draft");
  }

  if (requiresPromptLikeAnswer(userInput) && !looksLikePromptAnswer(draft)) {
    issues.push("requested_prompt_not_present_in_revised_draft");
  }

  return dedupe(issues);
}

function hasAnyUserGoalSignalInDraft(
  normalizedUserInput: string,
  normalizedDraft: string,
): boolean {
  const salientTerms = extractSalientTerms(normalizedUserInput);

  if (salientTerms.length === 0) {
    return true;
  }

  return salientTerms.some((term) => normalizedDraft.includes(term));
}

function extractSalientTerms(normalizedText: string): string[] {
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
    "the",
    "and",
    "that",
    "this",
    "need",
    "want",
    "answer",
  ]);

  return dedupe(
    normalizedText
      .split(/\s+/g)
      .map((term) => term.trim())
      .filter((term) => term.length >= 5 && !stopwords.has(term)),
  ).slice(0, 12);
}

function buildRiskIssues(risks: {
  readonly logicRisk: CouncilRiskLevel;
  readonly evidenceRisk: CouncilRiskLevel;
  readonly completenessRisk: CouncilRiskLevel;
  readonly sycophancyRisk: CouncilRiskLevel;
  readonly communicationRisk: CouncilRiskLevel;
}): string[] {
  return dedupe(
    Object.entries(risks)
      .filter(([, risk]) => risk !== "low")
      .map(([name, risk]) => `risk:${name}:${risk}`),
  );
}

function buildHardRiskIssues(risks: {
  readonly logicRisk: CouncilRiskLevel;
  readonly evidenceRisk: CouncilRiskLevel;
  readonly completenessRisk: CouncilRiskLevel;
  readonly sycophancyRisk: CouncilRiskLevel;
  readonly communicationRisk: CouncilRiskLevel;
}): string[] {
  return dedupe(
    Object.entries(risks)
      .filter(([, risk]) => isRiskAtLeast(risk, "high"))
      .map(([name, risk]) => `hard_risk:${name}:${risk}`),
  );
}

function getDeliveryDecision(source: unknown): DeliveryDecisionLike {
  const deliveryDecision = getUnknownProperty(source, "deliveryDecision");

  if (!isRecord(deliveryDecision)) {
    return {
      canDeliver: null,
      requiredAction: null,
      reasons: [],
    };
  }

  return {
    canDeliver: getBooleanProperty(deliveryDecision, "canDeliver"),
    requiredAction: normalizeNullableAction(
      getUnknownProperty(deliveryDecision, "requiredAction"),
    ),
    reasons: getStringArrayProperty(deliveryDecision, "reasons"),
  };
}

function requiresCodeLikeAnswer(normalizedUserInput: string): boolean {
  return /\b(codigo|code|typescript|javascript|python|funcao|function|classe|class|arquivo)\b/.test(
    normalizedUserInput,
  );
}

function looksLikeCodeAnswer(rawDraft: string): boolean {
  return (
    /```[\s\S]+```/.test(rawDraft) ||
    /\b(import|export|function|const|let|class|interface|type)\b/.test(rawDraft)
  );
}

function requiresPromptLikeAnswer(normalizedUserInput: string): boolean {
  return /\b(prompt|codex)\b/.test(normalizedUserInput);
}

function looksLikePromptAnswer(normalizedDraft: string): boolean {
  return (
    normalizedDraft.includes("voce deve") ||
    normalizedDraft.includes("você deve") ||
    normalizedDraft.includes("you must") ||
    normalizedDraft.includes("objetivo") ||
    normalizedDraft.includes("instrucoes") ||
    normalizedDraft.includes("instruções")
  );
}

function normalizeIssueKey(issue: string): string {
  return normalizeText(issue)
    .replace(/\d+/g, "#")
    .replace(/["'`]/g, "")
    .trim();
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

function normalizeAction(value: unknown): CouncilAction {
  const normalized = normalizeText(String(value ?? ""));

  if (
    normalized === "approve" ||
    normalized === "revise" ||
    normalized === "regenerate" ||
    normalized === "ask_clarification" ||
    normalized === "send_with_caveat" ||
    normalized === "block_delivery"
  ) {
    return normalized;
  }

  return "revise";
}

function normalizeNullableAction(value: unknown): CouncilAction | null {
  const normalized = normalizeText(String(value ?? ""));

  if (!normalized) {
    return null;
  }

  return normalizeAction(normalized);
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

function isRiskAtLeast(
  risk: CouncilRiskLevel,
  minimum: CouncilRiskLevel,
): boolean {
  return RISK_WEIGHT[risk] >= RISK_WEIGHT[minimum];
}

function getStringArrayProperty(source: unknown, key: string): string[] {
  if (!isRecord(source)) {
    return [];
  }

  const value = source[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return dedupe(
    value
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean),
  );
}

function getBooleanProperty(source: unknown, key: string): boolean | null {
  if (!isRecord(source)) {
    return null;
  }

  const value = source[key];

  return typeof value === "boolean" ? value : null;
}

function getUnknownProperty(source: unknown, key: string): unknown {
  if (!isRecord(source)) {
    return undefined;
  }

  return source[key];
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

    if (!cleaned || seen.has(cleaned)) {
      continue;
    }

    seen.add(cleaned);
    result.push(cleaned);
  }

  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}