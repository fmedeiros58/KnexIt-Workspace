/**
 * Layer: 14-reasoning-and-generation-layer/problem-resolution-core
 * Module: constraint-ledger
 * Responsibility: Keep a durable ledger of constraints and detect dropped obligations.
 */

import type {
  ProblemRepresentation,
  ReasoningRisk,
} from "./problem-resolution-types";
import { detectActionBudgetViolation as detectActionBudgetViolationFromExtractor } from "./action-budget-extractor";
import { detectObservationLimitViolation as detectObservationLimitViolationFromExtractor } from "./observation-limit-extractor";
import { detectUnresolvedAssignments } from "./domain-variable-mapper";

export interface ConstraintLedgerResult {
  ledger: string[];
  unresolvedVariables: string[];
  violatedConstraints: string[];
  missingObligations: string[];
  actionBudgetViolation: boolean;
  observationLimitViolation: boolean;
  assignmentRuleViolations: string[];
  risks: ReasoningRisk[];
}

interface ConstraintViolationResult {
  readonly violated: boolean;
  readonly reason?: string;
}

interface LedgerContext {
  readonly representation: ProblemRepresentation;
  readonly draft: string;
  readonly normalizedDraft: string;

  readonly explicitConstraints: string[];
  readonly implicitConstraints: string[];
  readonly invariants: string[];
  readonly completionObligations: string[];
  readonly closureRequirements: string[];

  readonly variables: string[];
  readonly scenarioBranches: string[];

  readonly actionBudget: ProblemRepresentation["actionBudget"];
  readonly observationLimits: ProblemRepresentation["observationLimits"];
  readonly domainMapping: ProblemRepresentation["domainMapping"];
}

type ConstraintKind =
  | "negative"
  | "operation_budget"
  | "observation_limit"
  | "exclusivity"
  | "required_presence"
  | "unknown";

const STOPWORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "ou",
  "a",
  "o",
  "as",
  "os",
  "um",
  "uma",
  "uns",
  "umas",
  "para",
  "por",
  "com",
  "sem",
  "que",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "the",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "with",
  "without",
  "that",
  "this",
]);

const NEGATION_MARKERS = [
  "nao",
  "não",
  "nunca",
  "jamais",
  "sem",
  "proibido",
  "vedado",
  "cannot",
  "can not",
  "must not",
  "do not",
  "dont",
  "don't",
  "without",
  "never",
  "forbidden",
  "not allowed",
];

const OPERATION_LIMIT_MARKERS = [
  "apenas uma",
  "apenas um",
  "somente uma",
  "somente um",
  "uma unica",
  "uma única",
  "um unico",
  "um único",
  "uma vez",
  "um vez",
  "no maximo uma",
  "no máximo uma",
  "no maximo um",
  "no máximo um",
  "only one",
  "one single",
  "single",
  "at most one",
  "exactly one",
  "only once",
];

const OPERATION_EXPANSION_MARKERS = [
  "repita",
  "repetir",
  "novamente",
  "de novo",
  "mais uma vez",
  "cada uma",
  "cada um",
  "uma por vez",
  "um por vez",
  "todos",
  "todas",
  "restantes",
  "demais",
  "outras",
  "outros",
  "mesmo processo",
  "mesmo procedimento",
  "faça o mesmo",
  "faca o mesmo",
  "repeat",
  "again",
  "once more",
  "each",
  "one by one",
  "every",
  "all of them",
  "remaining",
  "others",
  "same process",
  "same procedure",
  "do the same",
];

const OBSERVATION_LIMIT_MARKERS = [
  "sem olhar",
  "nao olhar",
  "não olhar",
  "sem ver",
  "nao ver",
  "não ver",
  "sem observar",
  "nao observar",
  "não observar",
  "sem verificar",
  "nao verificar",
  "não verificar",
  "without looking",
  "without seeing",
  "without observing",
  "without checking",
  "do not look",
  "cannot look",
  "no additional observation",
];

const OBSERVATION_ACTION_MARKERS = [
  "olhar",
  "ver",
  "observar",
  "verificar",
  "checar",
  "abrir",
  "inspecionar",
  "consultar",
  "look",
  "see",
  "observe",
  "check",
  "inspect",
  "open",
  "consult",
];

const EXCLUSIVITY_MARKERS = [
  "exatamente um",
  "exatamente uma",
  "um para um",
  "uma para uma",
  "cada valor",
  "cada item",
  "mutuamente exclusivo",
  "sem repetir",
  "nao repetir",
  "não repetir",
  "only once",
  "one to one",
  "one-to-one",
  "mutually exclusive",
  "without repetition",
  "no repetition",
];

const SCENARIO_OBLIGATION_MARKERS = [
  "cenario",
  "cenário",
  "caso",
  "hipotese",
  "hipótese",
  "possibilidade",
  "alternativa",
  "ramo",
  "branch",
  "scenario",
  "case",
  "hypothesis",
  "possibility",
  "alternative",
];

const ASSIGNMENT_OBLIGATION_MARKERS = [
  "atribuir",
  "associar",
  "mapear",
  "determinar",
  "identificar",
  "resolver todas",
  "resolver todos",
  "assign",
  "map",
  "determine",
  "identify",
  "resolve all",
];

export function buildConstraintLedger(
  representation: ProblemRepresentation,
  draftAnswer: string,
): ConstraintLedgerResult {
  const context = buildLedgerContext(representation, draftAnswer);

  const ledger = buildLedger(context);

  const assignmentAudit = safeDetectUnresolvedAssignments(
    context.domainMapping,
    context.draft,
  );

  const unresolvedVariables = resolveUnresolvedVariables(
    context,
    assignmentAudit.missingVariables,
  );

  const missingObligations = detectMissingObligations(context);

  const violatedConstraints = detectAllViolatedConstraints(
    context,
    assignmentAudit.violatedAssignmentRules,
  );

  const actionBudgetViolation = detectActionBudgetViolationFromExtractor(
    context.actionBudget,
    context.draft,
  );

  const observationLimitViolation = detectObservationLimitViolationFromExtractor(
    context.observationLimits,
    context.draft,
  );

  if (actionBudgetViolation.violated) {
    violatedConstraints.push(
      `formal_operation_budget_violation :: ${actionBudgetViolation.reasons.join(
        " | ",
      )}`,
    );
  }

  if (observationLimitViolation.violated) {
    violatedConstraints.push(
      `formal_observation_limit_violation :: ${observationLimitViolation.reasons.join(
        " | ",
      )}`,
    );
  }

  if (assignmentAudit.violatedAssignmentRules.length > 0) {
    violatedConstraints.push(
      `formal_assignment_rule_violation :: ${assignmentAudit.violatedAssignmentRules.join(
        " | ",
      )}`,
    );
  }

  const dedupedViolatedConstraints = dedupe(violatedConstraints);
  const dedupedAssignmentRules = dedupe(assignmentAudit.violatedAssignmentRules);

  const risks = buildRisks({
    unresolvedVariables,
    violatedConstraints: dedupedViolatedConstraints,
    missingObligations,
    actionBudgetViolation: actionBudgetViolation.violated,
    observationLimitViolation: observationLimitViolation.violated,
    assignmentRuleViolations: dedupedAssignmentRules,
  });

  return {
    ledger,
    unresolvedVariables,
    violatedConstraints: dedupedViolatedConstraints,
    missingObligations,
    actionBudgetViolation: actionBudgetViolation.violated,
    observationLimitViolation: observationLimitViolation.violated,
    assignmentRuleViolations: dedupedAssignmentRules,
    risks,
  };
}

function buildLedgerContext(
  representation: ProblemRepresentation,
  draftAnswer: string,
): LedgerContext {
  const draft = String(draftAnswer ?? "");

  return {
    representation,
    draft,
    normalizedDraft: normalize(draft),

    explicitConstraints: safeStringArray(representation.explicitConstraints),
    implicitConstraints: safeStringArray(representation.implicitConstraints),
    invariants: safeStringArray(representation.invariants),
    completionObligations: safeStringArray(
      representation.completionObligations,
    ),
    closureRequirements: getStringArrayProperty(
      representation,
      "closureRequirements",
    ),

    variables: safeStringArray(representation.variables),
    scenarioBranches: getScenarioBranchSignals(representation),

    actionBudget: representation.actionBudget,
    observationLimits: representation.observationLimits,
    domainMapping: representation.domainMapping,
  };
}

function buildLedger(context: LedgerContext): string[] {
  return dedupe([
    ...context.explicitConstraints.map((item) => `explicit:${item}`),
    ...context.implicitConstraints.map((item) => `implicit:${item}`),
    ...context.invariants.map((item) => `invariant:${item}`),
    ...context.completionObligations.map((item) => `obligation:${item}`),
    ...context.closureRequirements.map((item) => `closure:${item}`),
    ...serializeActionBudget(context.actionBudget).map(
      (item) => `actionBudget:${item}`,
    ),
    ...serializeObservationLimits(context.observationLimits).map(
      (item) => `observationLimit:${item}`,
    ),
    ...serializeDomainMapping(context.domainMapping).map(
      (item) => `domainMapping:${item}`,
    ),
    ...context.scenarioBranches.map((item) => `scenario:${item}`),
  ]);
}

function resolveUnresolvedVariables(
  context: LedgerContext,
  assignmentMissingVariables: readonly string[],
): string[] {
  const heuristicUnresolvedVariables = detectUnresolvedVariables({
    variables: context.variables,
    draft: context.draft,
    normalizedDraft: context.normalizedDraft,
  });

  if ((context.domainMapping?.variables?.length ?? 0) > 0) {
    return dedupe(assignmentMissingVariables);
  }

  return dedupe([
    ...heuristicUnresolvedVariables,
    ...assignmentMissingVariables,
  ]);
}

function safeDetectUnresolvedAssignments(
  domainMapping: ProblemRepresentation["domainMapping"],
  draft: string,
): {
  missingVariables: string[];
  duplicateAssignments: string[];
  violatedAssignmentRules: string[];
} {
  try {
    const result = detectUnresolvedAssignments(domainMapping, draft);

    return {
      missingVariables: safeStringArray(result?.missingVariables),
      duplicateAssignments: safeStringArray(result?.duplicateAssignments),
      violatedAssignmentRules: safeStringArray(result?.violatedAssignmentRules),
    };
  } catch {
    return {
      missingVariables: [],
      duplicateAssignments: [],
      violatedAssignmentRules: [],
    };
  }
}

function detectUnresolvedVariables(input: {
  readonly variables: readonly string[];
  readonly draft: string;
  readonly normalizedDraft: string;
}): string[] {
  return input.variables.filter((variable) => {
    const normalizedVariable = normalize(variable);

    if (!normalizedVariable) {
      return false;
    }

    if (normalizedVariable.length <= 2) {
      return !hasExactToken(input.normalizedDraft, normalizedVariable);
    }

    return !hasSemanticOverlap(variable, input.draft, 0.24);
  });
}

function detectMissingObligations(context: LedgerContext): string[] {
  const missing: string[] = [];

  for (const obligation of dedupe([
    ...context.completionObligations,
    ...context.closureRequirements,
  ])) {
    if (isSymbolicObligation(obligation)) {
      continue;
    }

    if (isScenarioObligation(obligation)) {
      if (
        !scenarioCoverageSatisfied(
          context.normalizedDraft,
          context.scenarioBranches,
        )
      ) {
        missing.push(obligation);
      }

      continue;
    }

    if (isAssignmentObligation(obligation)) {
      const unresolved = detectUnresolvedVariables({
        variables: context.variables,
        draft: context.draft,
        normalizedDraft: context.normalizedDraft,
      });

      if (unresolved.length > 0) {
        missing.push(obligation);
      }

      continue;
    }

    const cleaned = obligation.replace(/^(respect|obligation|closure):/i, "");

    if (!hasSemanticOverlap(cleaned, context.draft, 0.22)) {
      missing.push(obligation);
    }
  }

  return dedupe(missing);
}

function detectAllViolatedConstraints(
  context: LedgerContext,
  assignmentRuleViolations: readonly string[],
): string[] {
  const violated = detectViolatedConstraints({
    constraints: dedupe([
      ...context.explicitConstraints,
      ...context.implicitConstraints,
      ...context.invariants,
    ]),
    draft: context.draft,
    normalizedDraft: context.normalizedDraft,
  });

  if (assignmentRuleViolations.length > 0) {
    violated.push(
      `assignment_rules :: ${assignmentRuleViolations.join(" | ")}`,
    );
  }

  return dedupe(violated);
}

function isSymbolicObligation(obligation: string): boolean {
  const raw = String(obligation ?? "").trim();

  if (!raw) {
    return true;
  }

  if (/^[a-z0-9_:-]+$/i.test(raw)) {
    return true;
  }

  return false;
}

function detectViolatedConstraints(input: {
  readonly constraints: readonly string[];
  readonly draft: string;
  readonly normalizedDraft: string;
}): string[] {
  const violated: string[] = [];

  for (const constraint of input.constraints) {
    const result = detectConstraintViolation(
      constraint,
      input.draft,
      input.normalizedDraft,
    );

    if (result.violated) {
      violated.push(
        result.reason ? `${constraint} :: ${result.reason}` : constraint,
      );
    }
  }

  return dedupe(violated);
}

function detectConstraintViolation(
  constraint: string,
  draft: string,
  normalizedDraft = normalize(draft),
): ConstraintViolationResult {
  const normalizedConstraint = normalize(constraint);

  if (!normalizedConstraint) {
    return { violated: false };
  }

  const kind = classifyConstraint(normalizedConstraint);

  if (kind === "operation_budget") {
    return detectOperationBudgetViolation(normalizedConstraint, normalizedDraft);
  }

  if (kind === "observation_limit") {
    return detectHeuristicObservationLimitViolation(
      normalizedConstraint,
      normalizedDraft,
    );
  }

  if (kind === "negative") {
    return detectNegativeConstraintViolation(
      normalizedConstraint,
      normalizedDraft,
    );
  }

  if (kind === "exclusivity") {
    return detectExclusivityViolation(normalizedConstraint, normalizedDraft);
  }

  if (kind === "required_presence") {
    return {
      violated: !hasSemanticOverlap(normalizedConstraint, normalizedDraft, 0.2),
      reason: "required constraint not preserved in draft",
    };
  }

  return { violated: false };
}

function classifyConstraint(normalizedConstraint: string): ConstraintKind {
  if (containsAny(normalizedConstraint, OPERATION_LIMIT_MARKERS)) {
    return "operation_budget";
  }

  if (containsAny(normalizedConstraint, OBSERVATION_LIMIT_MARKERS)) {
    return "observation_limit";
  }

  if (containsAny(normalizedConstraint, EXCLUSIVITY_MARKERS)) {
    return "exclusivity";
  }

  if (containsAny(normalizedConstraint, NEGATION_MARKERS)) {
    return "negative";
  }

  if (
    /\b(deve|precisa|obrigatorio|obrigatorio|must|should|required|preserve|preservar|respect|respeitar)\b/.test(
      normalizedConstraint,
    )
  ) {
    return "required_presence";
  }

  return "unknown";
}

function detectOperationBudgetViolation(
  normalizedConstraint: string,
  normalizedDraft: string,
): ConstraintViolationResult {
  if (!containsAny(normalizedConstraint, OPERATION_LIMIT_MARKERS)) {
    return { violated: false };
  }

  const expansionDetected = containsAny(
    normalizedDraft,
    OPERATION_EXPANSION_MARKERS,
  );

  if (!expansionDetected) {
    return { violated: false };
  }

  return {
    violated: true,
    reason:
      "draft expands a limited operation into repeated, sequential, universal or multi-target operations",
  };
}

function detectHeuristicObservationLimitViolation(
  normalizedConstraint: string,
  normalizedDraft: string,
): ConstraintViolationResult {
  if (!containsAny(normalizedConstraint, OBSERVATION_LIMIT_MARKERS)) {
    return { violated: false };
  }

  const sentences = splitSentences(normalizedDraft);

  for (const sentence of sentences) {
    const hasObservationAction = containsAny(
      sentence,
      OBSERVATION_ACTION_MARKERS,
    );

    if (!hasObservationAction) {
      continue;
    }

    if (!hasLocalNegation(sentence)) {
      return {
        violated: true,
        reason:
          "draft uses observation, inspection or checking action without preserving the observation limit",
      };
    }
  }

  return { violated: false };
}

function detectNegativeConstraintViolation(
  normalizedConstraint: string,
  normalizedDraft: string,
): ConstraintViolationResult {
  const forbiddenSegments = extractForbiddenSegments(normalizedConstraint);

  if (forbiddenSegments.length === 0) {
    return { violated: false };
  }

  const sentences = splitSentences(normalizedDraft);

  for (const segment of forbiddenSegments) {
    const segmentTokens = tokenize(segment);
    const segmentSymbolTokens = extractShortSymbolTokens(segment);

    if (segmentTokens.length === 0 && segmentSymbolTokens.length === 0) {
      continue;
    }

    for (const sentence of sentences) {
      if (
        segmentSymbolTokens.length > 0 &&
        segmentSymbolTokens.some((token) => hasExactToken(sentence, token)) &&
        !hasLocalNegation(sentence)
      ) {
        return {
          violated: true,
          reason: `forbidden symbol appears affirmatively: ${segmentSymbolTokens.join(
            ", ",
          )}`,
        };
      }

      if (!hasSemanticOverlap(segment, sentence, 0.36)) {
        continue;
      }

      if (!hasLocalNegation(sentence)) {
        return {
          violated: true,
          reason: `forbidden content appears affirmatively: ${segment}`,
        };
      }
    }
  }

  return { violated: false };
}

function detectExclusivityViolation(
  normalizedConstraint: string,
  normalizedDraft: string,
): ConstraintViolationResult {
  if (!containsAny(normalizedConstraint, EXCLUSIVITY_MARKERS)) {
    return { violated: false };
  }

  if (
    /\b(mesmo valor|mesma opcao|mesma opção|valor repetido|opcao repetida|opção repetida|same value|same option|duplicate|repeated value)\b/.test(
      normalizedDraft,
    ) &&
    !hasLocalNegation(normalizedDraft)
  ) {
    return {
      violated: true,
      reason: "draft appears to reuse or duplicate values despite exclusivity",
    };
  }

  return { violated: false };
}

function isScenarioObligation(obligation: string): boolean {
  return containsAny(normalize(obligation), SCENARIO_OBLIGATION_MARKERS);
}

function isAssignmentObligation(obligation: string): boolean {
  return containsAny(normalize(obligation), ASSIGNMENT_OBLIGATION_MARKERS);
}

function scenarioCoverageSatisfied(
  normalizedDraft: string,
  scenarioBranches: readonly string[],
): boolean {
  if (scenarioBranches.length > 0) {
    const coveredBranches = scenarioBranches.filter((scenario) =>
      hasSemanticOverlap(scenario, normalizedDraft, 0.22),
    );

    return coveredBranches.length === scenarioBranches.length;
  }

  const branchMarkers = countMatches(
    normalizedDraft,
    /\b(se|caso|quando|supondo|cenario|cenario|if|case|when|assuming|scenario)\b/g,
  );

  return branchMarkers >= 2;
}

function buildRisks(input: {
  readonly unresolvedVariables: readonly string[];
  readonly violatedConstraints: readonly string[];
  readonly missingObligations: readonly string[];
  readonly actionBudgetViolation: boolean;
  readonly observationLimitViolation: boolean;
  readonly assignmentRuleViolations: readonly string[];
}): ReasoningRisk[] {
  const risks: ReasoningRisk[] = [];

  if (input.unresolvedVariables.length > 0) {
    risks.push({
      type: "unresolved_variable",
      severity: input.unresolvedVariables.length > 2 ? "high" : "medium",
      message: `Unresolved variables: ${input.unresolvedVariables.join(", ")}`,
    });
  }

  if (input.violatedConstraints.length > 0) {
    risks.push({
      type: "abandoned_constraint",
      severity: input.violatedConstraints.length > 1 ? "high" : "medium",
      message: `Violated constraints: ${input.violatedConstraints.join(" | ")}`,
    });
  }

  if (input.missingObligations.length > 0) {
    risks.push({
      type: "incomplete_case_analysis",
      severity: input.missingObligations.length > 2 ? "high" : "medium",
      message: `Missing completion obligations: ${input.missingObligations.join(
        " | ",
      )}`,
    });
  }

  if (input.actionBudgetViolation) {
    risks.push({
      type: "abandoned_constraint",
      severity: "high",
      message: "Operation-budget violation detected in draft.",
    });
  }

  if (input.observationLimitViolation) {
    risks.push({
      type: "abandoned_constraint",
      severity: "high",
      message: "Observation-limit violation detected in draft.",
    });
  }

  if (input.assignmentRuleViolations.length > 0) {
    risks.push({
      type: "unsupported_conclusion",
      severity: "high",
      message: `Assignment rule violations: ${input.assignmentRuleViolations.join(
        " | ",
      )}`,
    });
  }

  return risks;
}

function extractForbiddenSegments(normalizedConstraint: string): string[] {
  const pieces = normalizedConstraint
    .split(
      /\b(nao|não|nunca|jamais|sem|cannot|can not|must not|do not|dont|without|never|forbidden|not allowed)\b/g,
    )
    .map((segment) => segment.trim())
    .filter(Boolean);

  const result: string[] = [];

  for (let index = 0; index < pieces.length; index += 1) {
    const previous = pieces[index - 1];
    const current = pieces[index];

    if (!previous || !NEGATION_MARKERS.includes(previous)) {
      continue;
    }

    const cleaned = current
      .split(/\b(e|ou|and|or|unless|exceto|salvo)\b/g)[0]
      .trim();

    if (cleaned) {
      result.push(cleaned);
    }
  }

  return dedupe(result);
}

function hasSemanticOverlap(
  candidate: string,
  reference: string,
  minOverlap = 0.3,
): boolean {
  const candidateTokens = new Set(tokenize(candidate));
  const referenceTokens = new Set(tokenize(reference));

  if (!candidateTokens.size || !referenceTokens.size) {
    return false;
  }

  let overlap = 0;

  for (const token of candidateTokens) {
    if (referenceTokens.has(token)) {
      overlap += 1;
    }
  }

  return (
    overlap / Math.max(1, Math.min(candidateTokens.size, referenceTokens.size)) >=
    minOverlap
  );
}

function containsAny(text: string, markers: readonly string[]): boolean {
  const normalized = normalize(text);

  return markers.some((marker) => {
    const normalizedMarker = normalize(marker);

    if (!normalizedMarker) {
      return false;
    }

    if (normalizedMarker.includes(" ")) {
      return normalized.includes(normalizedMarker);
    }

    return new RegExp(`\\b${escapeRegExp(normalizedMarker)}\\b`).test(
      normalized,
    );
  });
}

function hasExactToken(text: string, token: string): boolean {
  const normalizedToken = normalize(token);

  if (!normalizedToken) {
    return false;
  }

  return new RegExp(`\\b${escapeRegExp(normalizedToken)}\\b`).test(text);
}

function hasLocalNegation(sentence: string): boolean {
  return containsAny(sentence, NEGATION_MARKERS);
}

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

function splitSentences(text: string): string[] {
  return normalize(text)
    .split(/[.!?;:\n]+/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .filter((token) => !STOPWORDS.has(token));
}

function extractShortSymbolTokens(text: string): string[] {
  return dedupe(
    normalize(text)
      .split(" ")
      .map((token) => token.trim())
      .filter(Boolean)
      .filter((token) => token.length > 0 && token.length < 3)
      .filter((token) => !STOPWORDS.has(token))
      .filter((token) => /^[a-z0-9_]+$/i.test(token)),
  );
}

function getScenarioBranchSignals(representation: ProblemRepresentation): string[] {
  const scenarioBranches = representation.scenarioBranches ?? [];

  const formalSignals = scenarioBranches.flatMap((branch) => {
    const record = branch as unknown as Record<string, unknown>;

    return [
      getRecordString(record, "condition"),
      getRecordString(record, "id"),
      ...getRecordStringArray(record, "expectedCoverageSignals"),
    ];
  });

  return dedupe([
    ...formalSignals,
    ...getStringArrayProperty(representation, "scenarios"),
  ]);
}

function serializeActionBudget(
  actionBudget: ProblemRepresentation["actionBudget"],
): string[] {
  if (!actionBudget || typeof actionBudget !== "object") {
    return [];
  }

  return dedupe([
    numberSignal("maxActions", actionBudget.maxActions),
    numberSignal("targetLimit", actionBudget.targetLimit),
    booleanSignal("repeatAllowed", actionBudget.repeatAllowed),
    typeof actionBudget.actionType === "string" ? actionBudget.actionType : "",
    ...safeStringArray(actionBudget.rawSignals),
  ]);
}

function serializeObservationLimits(
  observationLimits: ProblemRepresentation["observationLimits"],
): string[] {
  if (!Array.isArray(observationLimits)) {
    return [];
  }

  return dedupe(
    observationLimits.flatMap((item) => {
      const record = item as unknown as Record<string, unknown>;

      return [
        getRecordString(record, "type"),
        getRecordString(record, "scope"),
        ...getRecordStringArray(record, "rawSignals"),
      ];
    }),
  );
}

function serializeDomainMapping(
  domainMapping: ProblemRepresentation["domainMapping"],
): string[] {
  if (!domainMapping || typeof domainMapping !== "object") {
    return [];
  }

  return dedupe([
    ...safeStringArray(domainMapping.variables),
    ...safeStringArray(domainMapping.domains),
    ...safeStringArray(domainMapping.assignmentRules),
  ]);
}

function numberSignal(label: string, value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${label}=${value}`
    : "";
}

function booleanSignal(label: string, value: unknown): string {
  return typeof value === "boolean" ? `${label}=${value}` : "";
}

function safeStringArray(values: readonly unknown[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return dedupe(
    values
      .map((value) => String(value ?? "").trim())
      .filter(Boolean),
  );
}

function getStringArrayProperty(source: unknown, key: string): string[] {
  if (!isRecord(source)) {
    return [];
  }

  return safeStringArray(source[key] as readonly unknown[] | undefined);
}

function getRecordString(source: Record<string, unknown>, key: string): string {
  const value = source[key];

  return typeof value === "string" ? value : "";
}

function getRecordStringArray(
  source: Record<string, unknown>,
  key: string,
): string[] {
  return safeStringArray(source[key] as readonly unknown[] | undefined);
}

function dedupe(values: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = String(value ?? "").trim();
    const key = normalize(cleaned);

    if (!cleaned || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function normalize(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s_.:-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
