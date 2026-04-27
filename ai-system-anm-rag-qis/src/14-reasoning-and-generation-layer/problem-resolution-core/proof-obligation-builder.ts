/**
 * Layer: 14-reasoning-and-generation-layer/problem-resolution-core
 * Module: proof-obligation-builder
 * Responsibility: Build and evaluate generic proof obligations for logical closure.
 */

import type {
  AssignmentConsistencyResult,
  ProblemRepresentation,
  ProofObligation,
  ProofObligationEvaluation,
  ReasoningRisk,
  ScenarioCoverageResult,
} from "./problem-resolution-types";

interface ProofEvaluationContext {
  violatedConstraints?: string[];
  scenarioCoverage?: ScenarioCoverageResult;
  assignmentConsistency?: AssignmentConsistencyResult;
  actionBudgetViolated?: boolean;
  observationLimitViolated?: boolean;
  unsupportedConclusions?: string[];
}

interface ObligationEvaluation {
  readonly id: string;
  readonly satisfied: boolean;
  readonly reason?: string;
}

const ELIMINATION_MARKERS = [
  "por eliminacao",
  "por eliminação",
  "eliminacao",
  "eliminação",
  "eliminar",
  "elimina",
  "descartar",
  "excluir",
  "resta",
  "sobra",
  "by elimination",
  "elimination",
  "eliminate",
  "excluding",
  "exclude",
  "ruled out",
  "remaining",
];

const ALTERNATIVE_COVERAGE_MARKERS = [
  "caso",
  "cenario",
  "cenário",
  "possibilidade",
  "alternativa",
  "hipotese",
  "hipótese",
  "se",
  "quando",
  "branch",
  "case",
  "scenario",
  "possibility",
  "alternative",
  "hypothesis",
  "if",
  "when",
];

const SUPPORT_MARKERS = [
  "porque",
  "pois",
  "uma vez que",
  "com base",
  "a partir",
  "decorre",
  "portanto",
  "logo",
  "premissa",
  "restricao",
  "restrição",
  "evidencia",
  "evidência",
  "cenario",
  "cenário",
  "caso",
  "because",
  "since",
  "based on",
  "from",
  "therefore",
  "thus",
  "premise",
  "constraint",
  "evidence",
  "scenario",
  "case",
];

const CONCLUSION_MARKERS = [
  "conclusao",
  "conclusão",
  "concluindo",
  "portanto",
  "logo",
  "assim",
  "resultado final",
  "resposta final",
  "therefore",
  "thus",
  "in conclusion",
  "final answer",
];

const MAPPING_MARKERS = [
  "mapeamento",
  "mapear",
  "atribuir",
  "atribuicao",
  "atribuição",
  "associar",
  "associacao",
  "associação",
  "corresponde",
  "mapping",
  "map",
  "assignment",
  "assign",
  "associate",
  "corresponds",
];

const COMPLETENESS_MARKERS = [
  "todos",
  "todas",
  "cada",
  "completo",
  "completa",
  "final",
  "all",
  "each",
  "complete",
  "final",
];

const CONSTRAINT_PRESERVATION_MARKERS = [
  "restricao",
  "restrição",
  "condicao",
  "condição",
  "limite",
  "regra",
  "constraint",
  "condition",
  "limit",
  "rule",
];

export function buildProofObligations(
  representation: ProblemRepresentation,
): ProofObligation[] {
  const obligations: ProofObligation[] = [];

  for (const constraint of representation.explicitConstraints ?? []) {
    const normalizedConstraint = normalize(constraint);

    if (!normalizedConstraint) {
      continue;
    }

    obligations.push({
      id: `preserve_constraint:${slug(constraint)}`,
      description: `Preserve explicit constraint: ${constraint}`,
      category: "preserve_constraint",
    });
  }

  if (representation.actionBudget) {
    obligations.push({
      id: "respect_action_budget",
      description:
        "Respect the bounded operation budget and avoid repeated, expanded or multi-target operations.",
      category: "avoid_forbidden_action",
    });
  }

  if ((representation.observationLimits ?? []).length > 0) {
    obligations.push({
      id: "respect_observation_limits",
      description:
        "Respect observation or access limits and avoid hidden, additional or disallowed information access.",
      category: "avoid_forbidden_action",
    });
  }

  if ((representation.scenarioBranches ?? []).length > 0) {
    obligations.push({
      id: "cover_all_scenario_branches",
      description:
        "Cover every scenario branch required by the problem before concluding.",
      category: "cover_scenario",
    });
  }

  const variables = [
    ...(representation.domainMapping?.variables ?? []),
    ...(representation.variables ?? []),
  ];

  if (dedupeStrings(variables).length > 0 && requiresAssignment(representation)) {
    obligations.push({
      id: "assign_all_variables",
      description:
        "Assign or resolve every required variable, entity, role or relation.",
      category: "assign_variable",
    });
  }

  if (requiresMappingValidation(representation)) {
    obligations.push({
      id: "validate_final_mapping",
      description:
        "Validate final mapping consistency, exclusivity and completeness rules.",
      category: "validate_mapping",
    });
  }

  if (requiresEliminationJustification(representation)) {
    obligations.push({
      id: "justify_elimination_steps",
      description:
        "If using elimination, identify the alternatives considered, what was eliminated and why the remaining option follows.",
      category: "justify_elimination",
    });
  }

  obligations.push({
    id: "support_final_conclusion",
    description:
      "Support the final conclusion with constraints, scenario reasoning, assignment consistency or explicit premises.",
    category: "support_conclusion",
  });

  return dedupeObligations(obligations);
}

export function evaluateProofObligations(
  obligations: ProofObligation[] | undefined,
  draftAnswer: string,
  context: ProofEvaluationContext = {},
): ProofObligationEvaluation {
  const safeObligations = Array.isArray(obligations) ? obligations : [];
  const evaluations = safeObligations
    .map((obligation) => evaluateSingleObligation(obligation, draftAnswer, context))
    .filter((evaluation): evaluation is ObligationEvaluation => Boolean(evaluation));

  const satisfied = evaluations
    .filter((evaluation) => evaluation.satisfied)
    .map((evaluation) => evaluation.id);

  const missing = evaluations
    .filter((evaluation) => !evaluation.satisfied)
    .map((evaluation) => evaluation.id);

  const risks = evaluations
    .filter((evaluation) => !evaluation.satisfied)
    .map((evaluation) => buildRiskForMissingObligation(evaluation));

  return {
    satisfied: dedupeStrings(satisfied),
    missing: dedupeStrings(missing),
    risks: dedupeRisks(risks),
  };
}

function evaluateSingleObligation(
  obligation: ProofObligation,
  draftAnswer: string,
  context: ProofEvaluationContext,
): ObligationEvaluation | null {
  const id = String(obligation.id ?? "").trim();

  if (!id) {
    return null;
  }

  switch (obligation.category) {
    case "preserve_constraint":
      return {
        id,
        satisfied: isConstraintPreserved(obligation, context),
        reason: "explicit constraint was violated or not preserved",
      };

    case "cover_scenario":
      return {
        id,
        satisfied: context.scenarioCoverage?.passed !== false,
        reason: "not all required scenario branches were covered",
      };

    case "assign_variable":
      return {
        id,
        satisfied: assignmentVariablesSatisfied(context.assignmentConsistency),
        reason: "not all required variables were assigned or resolved",
      };

    case "validate_mapping":
      return {
        id,
        satisfied: mappingValidationSatisfied(context.assignmentConsistency),
        reason: "mapping consistency, exclusivity or completeness failed",
      };

    case "justify_elimination":
      return {
        id,
        satisfied: eliminationJustified(draftAnswer, context),
        reason: "elimination was used without sufficient alternative coverage",
      };

    case "avoid_forbidden_action":
      return {
        id,
        satisfied: forbiddenActionAvoided(obligation, context),
        reason: "draft violated a forbidden operation or access limit",
      };

    case "support_conclusion":
      return {
        id,
        satisfied: finalConclusionSupported(draftAnswer, context),
        reason: "final conclusion is unsupported or detached from premises",
      };

    default:
      return {
        id,
        satisfied: true,
      };
  }
}

function isConstraintPreserved(
  obligation: ProofObligation,
  context: ProofEvaluationContext,
): boolean {
  const violated = context.violatedConstraints ?? [];

  if (violated.length === 0) {
    return true;
  }

  const obligationText = normalize(
    `${obligation.id} ${obligation.description}`,
  );

  const matchingViolation = violated.some((violation) => {
    const normalizedViolation = normalize(violation);

    return (
      normalizedViolation.includes(slug(obligation.id)) ||
      hasSemanticOverlap(obligationText, normalizedViolation, 0.28)
    );
  });

  if (matchingViolation) {
    return false;
  }

  const hasGenericConstraintFailure = violated.some((violation) =>
    containsAny(violation, [
      "formal_operation_budget_violation",
      "formal_observation_limit_violation",
      "formal_assignment_rule_violation",
      "abandoned_constraint",
      "violated constraint",
    ]),
  );

  if (hasGenericConstraintFailure) {
    return false;
  }

  return true;
}

function assignmentVariablesSatisfied(
  assignmentConsistency: AssignmentConsistencyResult | undefined,
): boolean {
  if (!assignmentConsistency) {
    return true;
  }

  return (
    assignmentConsistency.allVariablesAssigned !== false &&
    assignmentConsistency.missingAssignments.length === 0
  );
}

function mappingValidationSatisfied(
  assignmentConsistency: AssignmentConsistencyResult | undefined,
): boolean {
  if (!assignmentConsistency) {
    return true;
  }

  return (
    assignmentConsistency.passed !== false &&
    assignmentConsistency.duplicateAssignments.length === 0 &&
    assignmentConsistency.violatedAssignmentRules.length === 0
  );
}

function eliminationJustified(
  draftAnswer: string,
  context: ProofEvaluationContext,
): boolean {
  const normalizedDraft = normalize(draftAnswer);
  const usesElimination = hasAnyMarker(normalizedDraft, ELIMINATION_MARKERS);

  if (!usesElimination) {
    return true;
  }

  const hasAlternativeCoverage =
    hasAnyMarker(normalizedDraft, ALTERNATIVE_COVERAGE_MARKERS) ||
    context.scenarioCoverage?.passed === true;

  const hasSupport = hasAnyMarker(normalizedDraft, SUPPORT_MARKERS);

  const scenarioCoverageNotFailed = context.scenarioCoverage?.passed !== false;

  return hasAlternativeCoverage && hasSupport && scenarioCoverageNotFailed;
}

function forbiddenActionAvoided(
  obligation: ProofObligation,
  context: ProofEvaluationContext,
): boolean {
  const normalized = normalize(`${obligation.id} ${obligation.description}`);

  if (
    normalized.includes("action_budget") ||
    normalized.includes("operation budget") ||
    normalized.includes("bounded operation")
  ) {
    return !context.actionBudgetViolated;
  }

  if (
    normalized.includes("observation") ||
    normalized.includes("access") ||
    normalized.includes("inspection")
  ) {
    return !context.observationLimitViolated;
  }

  return !context.actionBudgetViolated && !context.observationLimitViolated;
}

function finalConclusionSupported(
  draftAnswer: string,
  context: ProofEvaluationContext,
): boolean {
  const unsupported = context.unsupportedConclusions ?? [];

  if (unsupported.length > 0) {
    return false;
  }

  if (hasConclusionWithoutSupport(draftAnswer)) {
    return false;
  }

  if (context.scenarioCoverage?.passed === false) {
    return false;
  }

  if (context.assignmentConsistency?.passed === false) {
    return false;
  }

  if (context.actionBudgetViolated || context.observationLimitViolated) {
    return false;
  }

  return true;
}

function requiresAssignment(representation: ProblemRepresentation): boolean {
  const searchable = normalize([
    representation.taskType,
    representation.logicalProblemKind ?? "",
    ...(representation.completionObligations ?? []),
    ...(representation.closureRequirements ?? []),
    ...(representation.invariants ?? []),
    ...(representation.domainMapping?.assignmentRules ?? []),
  ].join(" "));

  if (representation.domainMapping && representation.domainMapping.variables.length > 0) {
    return true;
  }

  return hasAnyMarker(searchable, [
    ...MAPPING_MARKERS,
    "assign_all_variables",
    "resolve_all_variables",
    "assignment_problem",
    "mapping_problem",
  ]);
}

function requiresMappingValidation(representation: ProblemRepresentation): boolean {
  const domainMapping = representation.domainMapping;

  if (!domainMapping) {
    return false;
  }

  if (
    domainMapping.domains.length > 0 ||
    domainMapping.assignmentRules.length > 0 ||
    Object.keys(domainMapping.assignments ?? {}).length > 0
  ) {
    return true;
  }

  const searchable = normalize([
    representation.logicalProblemKind ?? "",
    ...(representation.completionObligations ?? []),
    ...(representation.closureRequirements ?? []),
    ...(representation.invariants ?? []),
  ].join(" "));

  return hasAnyMarker(searchable, [
    ...MAPPING_MARKERS,
    ...COMPLETENESS_MARKERS,
    "validate_final_mapping",
    "preserve_exclusivity",
  ]);
}

function requiresEliminationJustification(
  representation: ProblemRepresentation,
): boolean {
  const searchable = normalize([
    representation.taskType,
    representation.logicalProblemKind ?? "",
    ...(representation.completionObligations ?? []),
    ...(representation.closureRequirements ?? []),
    ...(representation.invariants ?? []),
  ].join(" "));

  return hasAnyMarker(searchable, ELIMINATION_MARKERS);
}

function hasConclusionWithoutSupport(draftAnswer: string): boolean {
  const normalized = normalize(draftAnswer);

  if (!hasAnyMarker(normalized, CONCLUSION_MARKERS)) {
    return false;
  }

  return !hasAnyMarker(normalized, [
    ...SUPPORT_MARKERS,
    ...CONSTRAINT_PRESERVATION_MARKERS,
    ...ALTERNATIVE_COVERAGE_MARKERS,
    ...MAPPING_MARKERS,
  ]);
}

function buildRiskForMissingObligation(
  evaluation: ObligationEvaluation,
): ReasoningRisk {
  return {
    type: "proof_obligation_missing",
    severity: inferSeverity(evaluation.id),
    message: evaluation.reason
      ? `Proof obligation not satisfied: ${evaluation.id}. ${evaluation.reason}.`
      : `Proof obligation not satisfied: ${evaluation.id}.`,
  };
}

function inferSeverity(id: string): ReasoningRisk["severity"] {
  const normalized = normalize(id);

  if (
    normalized.includes("action_budget") ||
    normalized.includes("observation_limits") ||
    normalized.includes("preserve_constraint")
  ) {
    return "high";
  }

  if (
    normalized.includes("cover_all_scenario") ||
    normalized.includes("assign_all") ||
    normalized.includes("validate_final_mapping")
  ) {
    return "high";
  }

  return "medium";
}

function hasAnyMarker(text: string, markers: readonly string[]): boolean {
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

function containsAny(text: string, markers: readonly string[]): boolean {
  return hasAnyMarker(text, markers);
}

function hasSemanticOverlap(
  left: string,
  right: string,
  minOverlap = 0.3,
): boolean {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return false;
  }

  let overlap = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(1, Math.min(leftTokens.size, rightTokens.size)) >= minOverlap;
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function dedupeObligations(
  obligations: readonly ProofObligation[],
): ProofObligation[] {
  return dedupeBy(obligations, (obligation) => normalize(obligation.id));
}

function dedupeStrings(values: ReadonlyArray<string>): string[] {
  return dedupeBy(
    values.map((value) => String(value ?? "").trim()).filter(Boolean),
    (value) => normalize(value),
  );
}

function dedupeRisks(risks: readonly ReasoningRisk[]): ReasoningRisk[] {
  return dedupeBy(
    risks,
    (risk) => `${risk.type}:${risk.message}`.toLowerCase(),
  );
}

function dedupeBy<T>(
  values: ReadonlyArray<T>,
  keyBuilder: (value: T) => string,
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const value of values) {
    const key = keyBuilder(value);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
}

function slug(value: string): string {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
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