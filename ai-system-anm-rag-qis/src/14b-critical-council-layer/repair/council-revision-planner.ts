import type {
  CouncilInput,
  CouncilRevisionPlan,
  CouncilSynthesisResult,
} from "../council-types";
import {
  extractProblemResolutionCouncilSignals,
  type ProblemResolutionCouncilSignals,
} from "../problem-resolution-signal-reader";

interface RevisionPriorityLike {
  readonly issue?: unknown;
  readonly reason?: unknown;
  readonly recommendedAction?: unknown;
  readonly severity?: unknown;
  readonly sourceAdvisor?: unknown;
}

interface RevisionCategoryBucket {
  readonly revisionGoals: string[];
  readonly rewriteInstructions: string[];
  readonly toneInstructions: string[];
  readonly evidenceInstructions: string[];
  readonly logicInstructions: string[];
  readonly antiSycophancyInstructions: string[];
}

type RevisionAction =
  | "approve"
  | "revise"
  | "regenerate"
  | "ask_clarification"
  | "send_with_caveat"
  | "block_delivery";

const GENERAL_CONSTRAINTS = [
  "Preserve the original user objective.",
  "Maintain the user's dominant language unless explicitly requested otherwise.",
  "Do not introduce unsupported claims during revision.",
  "Do not remove necessary critique merely to sound agreeable.",
  "Keep the final answer aligned with the user's real task, not only with the draft's current wording.",
];

const CATEGORY_PATTERNS = {
  antiSycophancy:
    /\b(sycophancy|bajula|agreement|over.?agreement|pleasing|premise|concord|validat|automatic)\b/i,
  evidence:
    /\b(evidence|evid[eê]ncia|unsupported|claim|source|fonte|citation|cita[cç][aã]o|confidence|certeza|data|dados|proof|prova)\b/i,
  logic:
    /\b(logic|l[oó]gica|contradiction|contradi[cç][aã]o|closure|fechamento|constraint|restri[cç][aã]o|scenario|cen[aá]rio|premise|premissa|inference|infer[eê]ncia|conclusion|conclus[aã]o)\b/i,
  tone:
    /\b(tone|tom|communication|comunica[cç][aã]o|aggressive|agressiv|language|idioma|clareza|clarity|repetition|repeti[cç][aã]o|verbose|prolix)\b/i,
};

export function buildCouncilRevisionPlan(
  synthesisResult: CouncilSynthesisResult,
  councilInput: CouncilInput,
): CouncilRevisionPlan {
  const recommendation = synthesisResult.finalRecommendation;
  const action = normalizeAction(getUnknownProperty(recommendation, "action"));
  const topIssues = getTopIssues(synthesisResult);
  const problemResolutionSignals =
    extractProblemResolutionCouncilSignals(councilInput);

  const buckets = buildInitialBuckets();

  addIssueDrivenInstructions(topIssues, buckets);
  addRecommendationDrivenInstructions(synthesisResult, buckets);
  addAssessmentDrivenInstructions(synthesisResult, buckets);
  addActionDrivenInstructions(action, buckets);
  addProblemResolutionDrivenInstructions(problemResolutionSignals, buckets);

  const constraintsToPreserve = dedupe([
    ...GENERAL_CONSTRAINTS,
    ...extractProblemResolutionConstraints(councilInput),
    ...extractProblemResolutionSignalConstraints(problemResolutionSignals),
    ...extractFormatConstraints(councilInput),
  ]);

  return {
    revisionRequired: shouldRequireRevision(action, buckets),
    regenerationRequired: shouldRequireRegeneration(action),
    revisionGoals: dedupe(buckets.revisionGoals),
    rewriteInstructions: dedupe(buckets.rewriteInstructions),
    constraintsToPreserve,
    toneInstructions: dedupe(buckets.toneInstructions),
    evidenceInstructions: dedupe(buckets.evidenceInstructions),
    logicInstructions: dedupe(buckets.logicInstructions),
    antiSycophancyInstructions: dedupe(buckets.antiSycophancyInstructions),
  };
}

function addProblemResolutionDrivenInstructions(
  signals: ProblemResolutionCouncilSignals,
  buckets: RevisionCategoryBucket,
): void {
  if (!signals.hasProblemResolutionState && !signals.hasProblemResolutionArtifact) {
    return;
  }

  if (signals.closurePassed === false) {
    buckets.revisionGoals.push(
      "Resolve the failed upstream problem-resolution closure before delivery.",
    );
    buckets.logicInstructions.push(
      "Rebuild the reasoning until explicit constraints, scenarios, assignments and proof obligations are closed.",
    );
  }

  if (signals.requiredActionFloor === "block_delivery") {
    buckets.revisionGoals.push(
      "Treat upstream problem-resolution blockers as non-deliverable until corrected.",
    );
    buckets.rewriteInstructions.push(
      "Do not deliver the current draft while upstream problem-resolution blockers remain.",
    );
  }

  if (signals.requiredActionFloor === "regenerate") {
    buckets.revisionGoals.push(
      "Regenerate the answer from the formal problem-resolution diagnostics.",
    );
    buckets.logicInstructions.push(
      "Do not patch only the surface text when formal closure, assignment or scenario coverage failed.",
    );
  }

  if (signals.shouldEscalateToCriticalCouncil === true) {
    buckets.revisionGoals.push(
      "Respect the upstream request to escalate problem-resolution findings into critical council review.",
    );
  }

  if (signals.unresolvedScenarios.length > 0) {
    buckets.logicInstructions.push(
      "Enumerate and close every unresolved scenario branch reported by problem-resolution.",
    );
  }

  if (signals.missingVariables.length > 0) {
    buckets.logicInstructions.push(
      "Provide explicit assignments for every variable reported missing by problem-resolution.",
    );
  }

  if (signals.violatedConstraints.length > 0) {
    buckets.logicInstructions.push(
      "Rewrite any step that violates upstream constraints instead of preserving the invalid path.",
    );
  }

  if (signals.unsupportedConclusions.length > 0) {
    buckets.logicInstructions.push(
      "Support every conclusion with premises, constraints, covered scenarios or validated assignments.",
    );
  }

  if (signals.missingProofObligations.length > 0) {
    buckets.logicInstructions.push(
      "Satisfy the missing proof obligations before presenting the final conclusion.",
    );
  }

  if (signals.scenarioCoveragePassed === false) {
    buckets.logicInstructions.push(
      "Convert scenario mentions into complete branch-by-branch consequences.",
    );
  }

  if (signals.assignmentConsistencyPassed === false) {
    buckets.logicInstructions.push(
      "Replace implied or partial mappings with a complete, non-duplicated assignment structure.",
    );
  }

  if (signals.repairMode === "regenerate") {
    buckets.rewriteInstructions.push(
      "Regenerate the draft because the problem-resolution repair planner rejected a light patch.",
    );
  } else if (signals.repairMode === "substantial_revision") {
    buckets.rewriteInstructions.push(
      "Apply a substantial revision guided by problem-resolution, not a cosmetic edit.",
    );
  }
}

function extractProblemResolutionSignalConstraints(
  signals: ProblemResolutionCouncilSignals,
): string[] {
  return dedupe([
    ...signals.violatedConstraints.map(
      (constraint) => `Upstream violated constraint to correct: ${constraint}`,
    ),
    ...signals.unresolvedScenarios.map(
      (scenario) => `Upstream unresolved scenario to close: ${scenario}`,
    ),
    ...signals.missingVariables.map(
      (variable) => `Upstream missing variable to assign: ${variable}`,
    ),
    ...signals.unsupportedConclusions.map(
      (conclusion) => `Upstream unsupported conclusion to ground: ${conclusion}`,
    ),
    ...signals.missingProofObligations.map(
      (obligation) => `Upstream proof obligation to satisfy: ${obligation}`,
    ),
    ...(signals.repairMode && signals.repairMode !== "none"
      ? [`Upstream repair mode to respect: ${signals.repairMode}`]
      : []),
  ]);
}

function buildInitialBuckets(): RevisionCategoryBucket {
  return {
    revisionGoals: [],
    rewriteInstructions: [],
    toneInstructions: [],
    evidenceInstructions: [],
    logicInstructions: [],
    antiSycophancyInstructions: [],
  };
}

function addIssueDrivenInstructions(
  topIssues: readonly RevisionPriorityLike[],
  buckets: RevisionCategoryBucket,
): void {
  for (const issue of topIssues) {
    const issueName = getString(issue.issue);
    const reason = getString(issue.reason);
    const recommendedAction = getString(issue.recommendedAction);
    const sourceAdvisor = getString(issue.sourceAdvisor);
    const severity = getString(issue.severity);

    const issueContext = normalizeText(
      [issueName, reason, recommendedAction, sourceAdvisor, severity].join(" "),
    );

    if (issueName) {
      buckets.revisionGoals.push(`Address council issue: ${issueName}.`);
    }

    if (reason) {
      buckets.rewriteInstructions.push(reason);
    }

    if (recommendedAction) {
      buckets.rewriteInstructions.push(
        `Apply recommended action: ${recommendedAction}.`,
      );
    }

    if (sourceAdvisor) {
      buckets.rewriteInstructions.push(
        `Respect the concern raised by ${sourceAdvisor}.`,
      );
    }

    if (CATEGORY_PATTERNS.antiSycophancy.test(issueContext)) {
      buckets.antiSycophancyInstructions.push(
        "Remove automatic agreement and evaluate the user's premise independently before validating it.",
      );
      buckets.antiSycophancyInstructions.push(
        "Replace generic praise with specific strengths, limitations and criteria-based critique.",
      );
    }

    if (CATEGORY_PATTERNS.evidence.test(issueContext)) {
      buckets.evidenceInstructions.push(
        "Separate evidence, inference, hypothesis and opinion before presenting the conclusion.",
      );
      buckets.evidenceInstructions.push(
        "Downgrade unsupported certainty claims or add concrete support when available.",
      );
    }

    if (CATEGORY_PATTERNS.logic.test(issueContext)) {
      buckets.logicInstructions.push(
        "Preserve all constraints and ensure the conclusion follows from explicit premises.",
      );
      buckets.logicInstructions.push(
        "Close unresolved variables, scenarios and inferential steps before giving the final answer.",
      );
    }

    if (CATEGORY_PATTERNS.tone.test(issueContext)) {
      buckets.toneInstructions.push(
        "Keep the critical stance, but make the tone respectful, clear and consistent with the user's language.",
      );
      buckets.toneInstructions.push(
        "Remove repetition, unnecessary language shifts and vague phrasing.",
      );
    }
  }
}

function addRecommendationDrivenInstructions(
  synthesisResult: CouncilSynthesisResult,
  buckets: RevisionCategoryBucket,
): void {
  const recommendation = synthesisResult.finalRecommendation;

  if (!recommendation) {
    buckets.revisionGoals.push("Create a valid final council recommendation.");
    buckets.rewriteInstructions.push(
      "Do not proceed without a final Council recommendation containing action, reasons and required revisions.",
    );
    return;
  }

  const requiredRevisions = getStringArrayProperty(
    recommendation,
    "requiredRevisions",
  );

  const optionalRevisions = getStringArrayProperty(
    recommendation,
    "optionalRevisions",
  );

  const caveats = getStringArrayProperty(recommendation, "caveats");
  const reasons = getStringArrayProperty(recommendation, "reasons");

  buckets.rewriteInstructions.push(...requiredRevisions);

  if (optionalRevisions.length > 0) {
    buckets.rewriteInstructions.push(
      ...optionalRevisions.map((revision) => `Optional refinement: ${revision}`),
    );
  }

  if (caveats.length > 0) {
    buckets.rewriteInstructions.push(
      ...caveats.map((caveat) => `Preserve caveat: ${caveat}`),
    );
  }

  if (reasons.length > 0) {
    buckets.revisionGoals.push(
      ...reasons.map((reason) => `Resolve Council reason: ${reason}`),
    );
  }
}

function addAssessmentDrivenInstructions(
  synthesisResult: CouncilSynthesisResult,
  buckets: RevisionCategoryBucket,
): void {
  const mainConcerns = getStringArrayProperty(synthesisResult, "mainConcerns");
  const missingCounterpoints = getStringArrayProperty(
    synthesisResult,
    "missingCounterpoints",
  );
  const unsupportedClaims = getStringArrayProperty(
    synthesisResult,
    "unsupportedClaims",
  );
  const contradictions = getStringArrayProperty(
    synthesisResult,
    "contradictions",
  );
  const overAgreementSignals = getStringArrayProperty(
    synthesisResult,
    "overAgreementSignals",
  );

  if (mainConcerns.length > 0) {
    buckets.revisionGoals.push(
      ...mainConcerns.map((concern) => `Resolve concern: ${concern}`),
    );
  }

  if (missingCounterpoints.length > 0) {
    buckets.rewriteInstructions.push(
      "Add the missing counterpoint, limitation or alternative hypothesis before concluding.",
    );
    buckets.logicInstructions.push(
      ...missingCounterpoints.map(
        (counterpoint) => `Address missing counterpoint: ${counterpoint}`,
      ),
    );
  }

  if (unsupportedClaims.length > 0) {
    buckets.evidenceInstructions.push(
      ...unsupportedClaims.map(
        (claim) => `Resolve unsupported claim: ${claim}`,
      ),
    );
    buckets.evidenceInstructions.push(
      "Remove unsupported certainty or explicitly mark unsupported claims as hypotheses or limits.",
    );
  }

  if (contradictions.length > 0) {
    buckets.logicInstructions.push(
      ...contradictions.map(
        (contradiction) => `Resolve contradiction: ${contradiction}`,
      ),
    );
    buckets.logicInstructions.push(
      "Do not deliver the answer while contradictions remain unresolved.",
    );
  }

  if (overAgreementSignals.length > 0) {
    buckets.antiSycophancyInstructions.push(
      ...overAgreementSignals.map(
        (signal) => `Remove over-agreement signal: ${signal}`,
      ),
    );
    buckets.antiSycophancyInstructions.push(
      "Preserve epistemic independence from the user's framing.",
    );
  }
}

function addActionDrivenInstructions(
  action: RevisionAction,
  buckets: RevisionCategoryBucket,
): void {
  switch (action) {
    case "approve":
      buckets.rewriteInstructions.push(
        "No major rewrite is required. Preserve the Council-approved answer and avoid introducing new unsupported claims.",
      );
      return;

    case "send_with_caveat":
      buckets.revisionGoals.push("Prepare the answer for caveated delivery.");
      buckets.rewriteInstructions.push(
        "Add explicit caveats for uncertain claims without over-softening conclusions that are supported.",
      );
      buckets.evidenceInstructions.push(
        "State what is known, what is inferred and what remains uncertain.",
      );
      return;

    case "ask_clarification":
      buckets.revisionGoals.push(
        "Clarify missing premises before producing a final answer.",
      );
      buckets.rewriteInstructions.push(
        "Ask only the minimum necessary clarification questions and explain why the missing information matters.",
      );
      return;

    case "regenerate":
      buckets.revisionGoals.push(
        "Regenerate the candidate answer from the Council findings.",
      );
      buckets.rewriteInstructions.push(
        "Regenerate the answer instead of patching the current draft if logic, completeness or evidence risks are central.",
      );
      buckets.logicInstructions.push(
        "Rebuild the reasoning chain from premises to conclusion.",
      );
      return;

    case "block_delivery":
      buckets.revisionGoals.push(
        "Block delivery until critical Council findings are resolved.",
      );
      buckets.rewriteInstructions.push(
        "Do not deliver the current answer. Resolve blocking risks before producing a final response.",
      );
      return;

    case "revise":
    default:
      buckets.revisionGoals.push(
        "Revise the candidate answer according to the Council's required findings.",
      );
      buckets.rewriteInstructions.push(
        "Apply the required revisions while preserving the user's objective and the strongest valid parts of the draft.",
      );
      return;
  }
}

function shouldRequireRevision(
  action: RevisionAction,
  buckets: RevisionCategoryBucket,
): boolean {
  if (action === "revise") {
    return true;
  }

  if (
    action === "approve" ||
    action === "send_with_caveat" ||
    action === "ask_clarification" ||
    action === "block_delivery"
  ) {
    return false;
  }

  return (
    buckets.rewriteInstructions.length > 0 ||
    buckets.logicInstructions.length > 0 ||
    buckets.evidenceInstructions.length > 0 ||
    buckets.antiSycophancyInstructions.length > 0 ||
    buckets.toneInstructions.length > 0
  );
}

function shouldRequireRegeneration(action: RevisionAction): boolean {
  return action === "regenerate";
}

function getTopIssues(
  synthesisResult: CouncilSynthesisResult,
): RevisionPriorityLike[] {
  const revisionPriority = getUnknownProperty(synthesisResult, "revisionPriority");

  if (!isRecord(revisionPriority)) {
    return [];
  }

  const topIssues = revisionPriority.topIssues;

  if (!Array.isArray(topIssues)) {
    return [];
  }

  return topIssues.filter(isRecord) as RevisionPriorityLike[];
}

function extractProblemResolutionConstraints(
  councilInput: CouncilInput,
): string[] {
  const state = getUnknownProperty(councilInput, "problemResolutionState");

  return dedupe([
    ...getNestedStringArray(state, ["explicitConstraints"]),
    ...getNestedStringArray(state, ["implicitConstraints"]),
    ...getNestedStringArray(state, ["invariants"]),
    ...getNestedStringArray(state, ["completionObligations"]),
    ...getNestedStringArray(state, ["formatRequirements"]),
    ...getNestedStringArray(state, ["closure", "violatedConstraints"]).map(
      (constraint) => `Previously violated constraint to preserve: ${constraint}`,
    ),
  ]);
}

function extractFormatConstraints(councilInput: CouncilInput): string[] {
  const userInput = normalizeText(councilInput.userInput ?? "");
  const constraints: string[] = [];

  if (
    /\b(codigo|code|typescript|javascript|python|arquivo|substitua)\b/.test(
      userInput,
    )
  ) {
    constraints.push(
      "If the user requested code, return code in a complete, copy-ready format.",
    );
  }

  if (/\b(prompt|codex)\b/.test(userInput)) {
    constraints.push(
      "If the user requested a prompt, make it reusable, explicit and copy-ready.",
    );
  }

  if (/\b(lista|topicos|tópicos|bullet|itens|items)\b/.test(userInput)) {
    constraints.push(
      "If the user requested a list, preserve list or itemized structure.",
    );
  }

  if (/\b(tabela|quadro|table)\b/.test(userInput)) {
    constraints.push(
      "If the user requested a table, preserve tabular organization.",
    );
  }

  if (/\b(resumido|breve|curto|conciso|objetivo)\b/.test(userInput)) {
    constraints.push("If the user requested brevity, keep the answer concise.");
  }

  return constraints;
}

function normalizeAction(action: unknown): RevisionAction {
  const normalized = normalizeText(String(action ?? ""));

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

function getStringArrayProperty(source: unknown, key: string): string[] {
  if (!isRecord(source)) {
    return [];
  }

  return toStringArray(source[key]);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => getString(entry))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getUnknownProperty(source: unknown, key: string): unknown {
  if (!isRecord(source)) {
    return undefined;
  }

  return source[key];
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

function normalizeText(text: string): string {
  return String(text ?? "")
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
