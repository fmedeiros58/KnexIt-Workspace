/**
 * Layer: 14-reasoning-and-generation-layer/problem-resolution-core
 * Module: step-completion-guard
 * Responsibility: Detect incomplete execution patterns in candidate drafts.
 */

import type {
  AssignmentConsistencyResult,
  ProblemRepresentation,
  ReasoningRisk,
  ReasoningScenario,
} from "./problem-resolution-types";
import { detectActionBudgetViolation } from "./action-budget-extractor";
import { detectObservationLimitViolation } from "./observation-limit-extractor";
import { detectUnresolvedAssignments } from "./domain-variable-mapper";
import { checkAssignmentConsistency } from "./assignment-consistency-checker";

export interface StepCompletionGuardResult {
  unresolvedScenarios: string[];
  unsupportedConclusions: string[];
  contradictions: string[];
  prematureClosureDetected: boolean;
  risks: ReasoningRisk[];
}

interface StepCompletionContext {
  readonly representation: ProblemRepresentation;
  readonly scenarios: ReasoningScenario[];
  readonly draftAnswer: string;
  readonly normalizedDraft: string;

  readonly unresolvedVariables: string[];

  readonly hasConclusion: boolean;
  readonly hasSupport: boolean;
  readonly hasCaseStructure: boolean;
  readonly hasElimination: boolean;
  readonly hasExecutedElimination: boolean;
  readonly hasAssignmentStructure: boolean;
  readonly hasDeterminationPromise: boolean;

  readonly actionBudgetViolated: boolean;
  readonly actionBudgetReasons: string[];

  readonly observationLimitViolated: boolean;
  readonly observationLimitReasons: string[];

  readonly assignmentPassed: boolean;
  readonly assignmentAllVariablesAssigned: boolean;
  readonly assignmentMissingVariables: string[];
  readonly assignmentDuplicateSignals: string[];
  readonly assignmentRuleViolations: string[];
  readonly assignmentExtractedAssignments: Record<string, string>;
  readonly assignmentBranchFailures: string[];
  readonly assignmentBranchMissingVariables: string[];
}

interface ScenarioResolutionResult {
  readonly id: string;
  readonly mentioned: boolean;
  readonly resolved: boolean;
  readonly evidence: string[];
  readonly failures: string[];
}

const CONCLUSION_MARKERS = [
  "conclusao",
  "conclusão",
  "concluindo",
  "portanto",
  "logo",
  "assim",
  "resultado final",
  "resposta final",
  "final answer",
  "therefore",
  "thus",
  "in conclusion",
];

const SUPPORT_MARKERS = [
  "porque",
  "pois",
  "uma vez que",
  "com base",
  "a partir",
  "decorre",
  "premissa",
  "restricao",
  "restrição",
  "regra",
  "cenario",
  "cenário",
  "caso",
  "hipotese",
  "hipótese",
  "evidencia",
  "evidência",
  "because",
  "since",
  "based on",
  "from",
  "premise",
  "constraint",
  "rule",
  "scenario",
  "case",
  "hypothesis",
  "evidence",
];

const CASE_MARKERS = [
  "se",
  "caso",
  "quando",
  "supondo",
  "cenario",
  "cenário",
  "hipotese",
  "hipótese",
  "possibilidade",
  "alternativa",
  "ramo",
  "if",
  "case",
  "when",
  "assuming",
  "scenario",
  "hypothesis",
  "possibility",
  "alternative",
  "branch",
];

const RESOLUTION_MARKERS = [
  "entao",
  "então",
  "logo",
  "portanto",
  "conclui",
  "concluimos",
  "concluímos",
  "decorre",
  "resulta",
  "fica",
  "resta",
  "sobra",
  "deve ser",
  "sera",
  "será",
  "corresponde",
  "recebe",
  "mapeia",
  "atribui",
  "associa",
  "contem",
  "contém",
  "then",
  "therefore",
  "thus",
  "follows",
  "results",
  "must be",
  "will be",
  "maps to",
  "corresponds",
  "receives",
  "is assigned",
  "contains",
];

const ASSIGNMENT_RELATION_MARKERS = [
  "->",
  "=>",
  "=",
  ":",
  "corresponde a",
  "recebe",
  "fica com",
  "fica sendo",
  "mapeia para",
  "atribuido a",
  "atribuído a",
  "associado a",
  "associada a",
  "contem",
  "contém",
  "maps to",
  "assigned to",
  "corresponds to",
  "contains",
];

const ELIMINATION_MARKERS = [
  "por eliminacao",
  "por eliminação",
  "eliminacao",
  "eliminação",
  "eliminar",
  "elimina",
  "descartar",
  "excluir",
  "nao pode ser",
  "não pode ser",
  "impossivel",
  "impossível",
  "resta",
  "sobra",
  "by elimination",
  "elimination",
  "eliminate",
  "excluding",
  "exclude",
  "ruled out",
  "cannot be",
  "impossible",
  "remaining",
];

const ELIMINATION_EXECUTION_MARKERS = [
  "nao pode ser",
  "não pode ser",
  "impossivel",
  "impossível",
  "elimina",
  "eliminar",
  "descarta",
  "descartar",
  "exclui",
  "excluir",
  "cannot be",
  "impossible",
  "eliminate",
  "ruled out",
  "exclude",
];

const REMAINING_RESULT_MARKERS = [
  "resta",
  "sobra",
  "logo",
  "portanto",
  "entao",
  "então",
  "therefore",
  "thus",
  "then",
  "remaining",
];

const PROMISE_WITHOUT_EXECUTION_MARKERS = [
  "pode ser determinado",
  "podem ser determinados",
  "podem ser determinadas",
  "pode ser descoberto",
  "podem ser descobertos",
  "podem ser descobertas",
  "basta eliminar",
  "por eliminacao",
  "por eliminação",
  "o restante fica claro",
  "o resto fica claro",
  "voce sabera",
  "você saberá",
  "can be determined",
  "can be discovered",
  "by elimination",
  "the rest follows",
  "the rest is clear",
];

const HIGH_CONFIDENCE_MARKERS = [
  "obviamente",
  "com certeza",
  "sem duvida",
  "sem dúvida",
  "definitivamente",
  "certamente",
  "obviously",
  "certainly",
  "definitely",
  "undoubtedly",
];

const FULL_DETERMINATION_MARKERS = [
  "determinar todos",
  "determinar todas",
  "resolver todos",
  "resolver todas",
  "identificar todos",
  "identificar todas",
  "mapear todos",
  "mapear todas",
  "atribuir todos",
  "atribuir todas",
  "determine all",
  "resolve all",
  "identify all",
  "map all",
  "assign all",
];

const ASSIGNMENT_REQUIREMENT_MARKERS = [
  "assign_all_variables",
  "validate_final_mapping",
  "mapping_required",
  "determine_all",
  "resolve_all_variables",
  "preserve_assignment_rules",
  "mapeamento",
  "mapear",
  "atribuir",
  "atribuicao",
  "atribuição",
  "associar",
  "assignment",
  "mapping",
  "assign",
  "map",
  "associate",
];

const SEQUENTIAL_START_MARKERS = [
  "primeiro",
  "1.",
  "passo 1",
  "etapa 1",
  "first",
  "first step",
  "step 1",
];

const SEQUENTIAL_CONTINUATION_MARKERS = [
  "segundo",
  "2.",
  "passo 2",
  "etapa 2",
  "depois",
  "em seguida",
  "second",
  "step 2",
  "then",
  "next",
];

const GENERIC_SCENARIO_TOKENS = new Set([
  "cenario",
  "cenário",
  "scenario",
  "caso",
  "case",
  "ramo",
  "branch",
  "possibilidade",
  "possibility",
  "alternativa",
  "alternative",
  "resultado",
  "result",
  "valor",
  "value",
  "dominio",
  "domínio",
  "domain",
  "entidade",
  "entity",
  "item",
  "opcao",
  "opção",
  "option",
  "source",
  "formal_branch",
  "conditional_clause",
  "domain_value",
  "possible_result",
]);

const STOPWORDS = new Set([
  "a",
  "o",
  "as",
  "os",
  "um",
  "uma",
  "uns",
  "umas",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "para",
  "por",
  "com",
  "sem",
  "que",
  "e",
  "ou",
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

const CONTRADICTION_PAIRS: ReadonlyArray<{
  readonly id: string;
  readonly left: readonly string[];
  readonly right: readonly string[];
}> = [
  {
    id: "always_vs_never",
    left: ["sempre", "always"],
    right: ["nunca", "jamais", "never"],
  },
  {
    id: "certainty_vs_maybe",
    left: ["certeza", "definitivamente", "certainly", "definitely"],
    right: ["talvez", "possivelmente", "maybe", "perhaps"],
  },
  {
    id: "can_vs_cannot_same_scope",
    left: ["pode", "permitido", "can", "allowed"],
    right: ["nao pode", "cannot", "not allowed", "forbidden"],
  },
  {
    id: "complete_vs_incomplete",
    left: ["completo", "suficiente", "complete", "sufficient"],
    right: ["incompleto", "insuficiente", "incomplete", "insufficient"],
  },
];

export function runStepCompletionGuard(input: {
  representation: ProblemRepresentation;
  scenarios: ReasoningScenario[];
  draftAnswer: string;
  unresolvedVariables: string[];
}): StepCompletionGuardResult {
  const context = buildContext(input);

  const scenarioResolution = evaluateScenarioResolution(context);
  const unresolvedScenarios = scenarioResolution
    .filter((scenario) => !scenario.resolved)
    .map((scenario) => scenario.id);

  const unsupportedConclusions = detectUnsupportedConclusions(
    context,
    scenarioResolution,
  );

  const contradictions = detectContradictions(context.normalizedDraft);

  const prematureClosureDetected = detectPrematureClosure({
    context,
    unresolvedScenarios,
    unsupportedConclusions,
    contradictions,
  });

  const risks = buildRisks({
    context,
    unresolvedScenarios,
    unsupportedConclusions,
    contradictions,
    prematureClosureDetected,
  });

  return {
    unresolvedScenarios,
    unsupportedConclusions,
    contradictions,
    prematureClosureDetected,
    risks,
  };
}

function buildContext(input: {
  representation: ProblemRepresentation;
  scenarios: ReasoningScenario[];
  draftAnswer: string;
  unresolvedVariables: string[];
}): StepCompletionContext {
  const draftAnswer = String(input.draftAnswer ?? "");
  const normalizedDraft = normalize(draftAnswer);

  const actionBudgetViolation = safeDetectActionBudgetViolation(
    input.representation,
    draftAnswer,
  );

  const observationLimitViolation = safeDetectObservationLimitViolation(
    input.representation,
    draftAnswer,
  );

  const mapperAudit = safeDetectUnresolvedAssignments(
    input.representation,
    draftAnswer,
  );

  const assignmentAudit = safeCheckAssignmentConsistency(
    input.representation,
    draftAnswer,
  );

  const assignmentMissingVariables = dedupe([
    ...mapperAudit.missingVariables,
    ...assignmentAudit.missingAssignments,
  ]);

  const assignmentRuleViolations = dedupe([
    ...mapperAudit.violatedAssignmentRules,
    ...assignmentAudit.violatedAssignmentRules,
  ]);

  const assignmentDuplicateSignals = dedupe([
    ...mapperAudit.duplicateAssignments,
    ...assignmentAudit.duplicateAssignments,
  ]);

  const extractedAssignments = readRecordField(
    assignmentAudit.raw,
    "extractedAssignments",
  );

  const branchFailures = readBranchFailures(assignmentAudit.raw);

  return {
    representation: input.representation,
    scenarios: Array.isArray(input.scenarios) ? input.scenarios : [],
    draftAnswer,
    normalizedDraft,
    unresolvedVariables: dedupe([
      ...safeStringArray(input.unresolvedVariables),
      ...assignmentMissingVariables,
    ]),

    hasConclusion: containsAny(normalizedDraft, CONCLUSION_MARKERS),
    hasSupport: containsAny(normalizedDraft, SUPPORT_MARKERS),
    hasCaseStructure: containsAny(normalizedDraft, CASE_MARKERS),
    hasElimination: containsAny(normalizedDraft, ELIMINATION_MARKERS),
    hasExecutedElimination: hasExecutedElimination(normalizedDraft),
    hasAssignmentStructure: hasAssignmentStructure(draftAnswer),
    hasDeterminationPromise: containsAny(
      normalizedDraft,
      PROMISE_WITHOUT_EXECUTION_MARKERS,
    ),

    actionBudgetViolated: actionBudgetViolation.violated,
    actionBudgetReasons: actionBudgetViolation.reasons,

    observationLimitViolated: observationLimitViolation.violated,
    observationLimitReasons: observationLimitViolation.reasons,

    assignmentPassed: assignmentAudit.passed,
    assignmentAllVariablesAssigned: assignmentAudit.allVariablesAssigned,
    assignmentMissingVariables,
    assignmentDuplicateSignals,
    assignmentRuleViolations,
    assignmentExtractedAssignments: extractedAssignments,
    assignmentBranchFailures: branchFailures.branchIds,
    assignmentBranchMissingVariables: branchFailures.missingVariables,
  };
}

function safeCheckAssignmentConsistency(
  representation: ProblemRepresentation,
  draftAnswer: string,
): {
  passed: boolean;
  allVariablesAssigned: boolean;
  missingAssignments: string[];
  duplicateAssignments: string[];
  violatedAssignmentRules: string[];
  raw: AssignmentConsistencyResult;
} {
  try {
    const result = checkAssignmentConsistency({
      domainMapping: representation.domainMapping,
      draftAnswer,
      explicitConstraints: representation.explicitConstraints,
      scenarioBranches: representation.scenarioBranches,
    });

    return {
      passed: result.passed,
      allVariablesAssigned: result.allVariablesAssigned,
      missingAssignments: safeStringArray(result.missingAssignments),
      duplicateAssignments: safeStringArray(result.duplicateAssignments),
      violatedAssignmentRules: safeStringArray(result.violatedAssignmentRules),
      raw: result,
    };
  } catch {
    return {
      passed: true,
      allVariablesAssigned: true,
      missingAssignments: [],
      duplicateAssignments: [],
      violatedAssignmentRules: [],
      raw: {
        passed: true,
        allVariablesAssigned: true,
        missingAssignments: [],
        duplicateAssignments: [],
        violatedAssignmentRules: [],
      },
    };
  }
}

function evaluateScenarioResolution(
  context: StepCompletionContext,
): ScenarioResolutionResult[] {
  if (context.scenarios.length === 0) {
    return [];
  }

  return context.scenarios.map((scenario, index) =>
    evaluateSingleScenarioResolution(context, scenario, index),
  );
}

function evaluateSingleScenarioResolution(
  context: StepCompletionContext,
  scenario: ReasoningScenario,
  index: number,
): ScenarioResolutionResult {
  const id = scenario.id || scenario.description || `scenario_${index + 1}`;
  const window = buildScenarioWindow(context, scenario);
  const evidence: string[] = [];
  const failures: string[] = [];

  const scenarioMentioned =
    window.length > 0 ||
    isScenarioMentionedByGlobalSignals(context, scenario);

  if (!scenarioMentioned) {
    failures.push("scenario_not_mentioned");

    return {
      id,
      mentioned: false,
      resolved: false,
      evidence,
      failures,
    };
  }

  evidence.push("scenario_mentioned");

  if (window) {
    evidence.push("scenario_local_window_found");
  }

  const localText = window || context.normalizedDraft;
  const hasResolution =
    hasLocalScenarioResolution(localText) ||
    hasLocalAssignmentResolution(localText) ||
    hasExecutedElimination(localText);

  if (hasResolution) {
    evidence.push("scenario_has_local_resolution");
  } else {
    failures.push("scenario_mentioned_without_local_resolution");
  }

  if (
    context.hasDeterminationPromise &&
    !hasResolution &&
    !context.hasAssignmentStructure
  ) {
    failures.push("scenario_promised_but_not_executed");
  }

  return {
    id,
    mentioned: true,
    resolved: hasResolution,
    evidence: dedupe(evidence),
    failures: dedupe(failures),
  };
}

function buildScenarioWindow(
  context: StepCompletionContext,
  scenario: ReasoningScenario,
): string {
  const scenarioSignals = extractScenarioSignals(scenario);

  if (scenarioSignals.length === 0) {
    return context.scenarios.length === 1 ? context.normalizedDraft : "";
  }

  const sentences = splitSentences(context.draftAnswer);
  const selected = new Set<number>();

  for (let index = 0; index < sentences.length; index += 1) {
    const sentence = normalize(sentences[index]);

    if (!sentence) {
      continue;
    }

    const matched = scenarioSignals.some((signal) =>
      hasMeaningfulReference(signal, sentence, 0.5),
    );

    if (matched) {
      selected.add(index);
      selected.add(index + 1);
      selected.add(index + 2);
    }
  }

  if (selected.size === 0) {
    return "";
  }

  return normalize(
    Array.from(selected)
      .filter((index) => index >= 0 && index < sentences.length)
      .sort((left, right) => left - right)
      .map((index) => sentences[index])
      .join(" "),
  );
}

function isScenarioMentionedByGlobalSignals(
  context: StepCompletionContext,
  scenario: ReasoningScenario,
): boolean {
  const scenarioSignals = extractScenarioSignals(scenario);

  if (scenarioSignals.length === 0) {
    return hasCaseStructureFromText(context.normalizedDraft);
  }

  const matched = scenarioSignals.filter((signal) =>
    hasMeaningfulReference(signal, context.normalizedDraft, 0.5),
  );

  const required =
    scenarioSignals.length <= 2
      ? scenarioSignals.length
      : Math.ceil(scenarioSignals.length * 0.45);

  return matched.length >= Math.max(1, required);
}

function extractScenarioSignals(scenario: ReasoningScenario): string[] {
  return dedupe([
    ...extractUsefulScenarioTokens(scenario.description),
    ...safeStringArray(scenario.assumptions).flatMap(extractUsefulScenarioTokens),
    ...safeStringArray(scenario.applicableConstraints).flatMap(
      extractUsefulScenarioTokens,
    ),
  ]).slice(0, 12);
}

function hasLocalScenarioResolution(localText: string): boolean {
  const normalized = normalize(localText);

  if (!normalized) {
    return false;
  }

  const hasResolutionMarker = containsAny(normalized, RESOLUTION_MARKERS);
  const hasSupport =
    containsAny(normalized, SUPPORT_MARKERS) ||
    containsAny(normalized, ASSIGNMENT_RELATION_MARKERS);

  return hasResolutionMarker && hasSupport;
}

function hasLocalAssignmentResolution(localText: string): boolean {
  const normalized = normalize(localText);

  if (!normalized) {
    return false;
  }

  if (
    /\b[a-z0-9_.:-]{1,80}\s*(?:=|->|=>)\s*[a-z0-9_.:-]{1,120}\b/.test(
      normalized,
    )
  ) {
    return true;
  }

  return (
    containsAny(normalized, ASSIGNMENT_RELATION_MARKERS) &&
    tokenize(normalized).filter((token) => !STOPWORDS.has(token)).length >= 3
  );
}

function hasExecutedElimination(normalizedText: string): boolean {
  const hasElimination = containsAny(normalizedText, ELIMINATION_MARKERS);

  if (!hasElimination) {
    return false;
  }

  const eliminatedSignals = countMarkers(
    normalizedText,
    ELIMINATION_EXECUTION_MARKERS,
  );

  const remainingSignals = countMarkers(
    normalizedText,
    REMAINING_RESULT_MARKERS,
  );

  return eliminatedSignals > 0 && remainingSignals > 0;
}

function detectUnsupportedConclusions(
  context: StepCompletionContext,
  scenarioResolution: readonly ScenarioResolutionResult[],
): string[] {
  const unsupported: string[] = [];
  const unresolvedScenarios = scenarioResolution
    .filter((scenario) => !scenario.resolved)
    .map((scenario) => scenario.id);

  if (
    containsAny(context.normalizedDraft, HIGH_CONFIDENCE_MARKERS) &&
    context.representation.explicitConstraints.length > 0 &&
    !constraintsSufficientlyReferenced(context)
  ) {
    unsupported.push("high_confidence_without_constraint_coverage");
  }

  if (
    containsAny(context.normalizedDraft, [
      "independentemente das premissas",
      "sem depender das premissas",
      "regardless of premises",
      "without depending on premises",
    ])
  ) {
    unsupported.push("conclusion_declared_without_premise_dependency");
  }

  if (context.hasElimination && !context.hasExecutedElimination) {
    unsupported.push("elimination_mentioned_but_not_executed");
  }

  if (
    context.hasElimination &&
    !hasEliminationCoverage(context, scenarioResolution)
  ) {
    unsupported.push("elimination_without_alternative_enumeration");
  }

  if (context.hasDeterminationPromise && !hasDeterminationExecution(context)) {
    unsupported.push("determination_promised_but_not_executed");
  }

  if (
    scenarioResolution.some(
      (scenario) => scenario.mentioned && !scenario.resolved,
    )
  ) {
    unsupported.push("scenario_mentioned_but_not_resolved");
  }

  if (context.hasCaseStructure && unresolvedScenarios.length > 0) {
    unsupported.push("case_analysis_started_but_not_closed");
  }

  if (
    containsAny(context.normalizedDraft, FULL_DETERMINATION_MARKERS) &&
    context.unresolvedVariables.length > 0
  ) {
    unsupported.push("claimed_full_determination_without_full_assignment");
  }

  if (hasGenericConclusionWithoutMapping(context)) {
    unsupported.push("generic_conclusion_without_mapping_structure");
  }

  if (!context.assignmentPassed) {
    unsupported.push("assignment_consistency_not_satisfied");
  }

  if (!context.assignmentAllVariablesAssigned) {
    unsupported.push("assignment_variables_not_fully_resolved");
  }

  if (context.assignmentBranchFailures.length > 0) {
    unsupported.push("branch_assignments_not_fully_resolved");
  }

  if (context.assignmentBranchMissingVariables.length > 0) {
    unsupported.push("branch_variables_missing_assignment");
  }

  if (context.actionBudgetViolated) {
    unsupported.push("operation_budget_violation_in_draft_steps");
  }

  if (context.observationLimitViolated) {
    unsupported.push("observation_limit_violation_in_draft_steps");
  }

  if (context.assignmentRuleViolations.length > 0) {
    unsupported.push("assignment_rules_violated_in_draft_steps");
  }

  if (context.assignmentDuplicateSignals.length > 0) {
    unsupported.push("duplicate_assignment_in_draft_steps");
  }

  if (
    context.hasConclusion &&
    !context.hasSupport &&
    hasFormalReasoningObligations(context)
  ) {
    unsupported.push("conclusion_without_visible_reasoning_support");
  }

  if (context.hasConclusion && unresolvedScenarios.length > 0) {
    unsupported.push("conclusion_before_scenario_closure");
  }

  if (context.hasConclusion && context.unresolvedVariables.length > 0) {
    unsupported.push("conclusion_before_variable_resolution");
  }

  if (hasStartedSequenceButNotCompleted(context)) {
    unsupported.push("step_sequence_started_but_not_completed");
  }

  return dedupe(unsupported);
}

function detectPrematureClosure(input: {
  context: StepCompletionContext;
  unresolvedScenarios: readonly string[];
  unsupportedConclusions: readonly string[];
  contradictions: readonly string[];
}): boolean {
  const { context, unresolvedScenarios, unsupportedConclusions, contradictions } =
    input;

  if (context.hasConclusion || context.hasDeterminationPromise) {
    return (
      unresolvedScenarios.length > 0 ||
      context.unresolvedVariables.length > 0 ||
      unsupportedConclusions.length > 0 ||
      contradictions.length > 0 ||
      context.actionBudgetViolated ||
      context.observationLimitViolated ||
      context.assignmentRuleViolations.length > 0 ||
      !context.assignmentPassed
    );
  }

  if (hasFormalReasoningObligations(context)) {
    return (
      context.draftAnswer.trim().length > 0 &&
      (
        unresolvedScenarios.length > 0 ||
        context.unresolvedVariables.length > 0 ||
        context.assignmentRuleViolations.length > 0 ||
        context.actionBudgetViolated ||
        context.observationLimitViolated ||
        !context.assignmentPassed
      )
    );
  }

  return false;
}

function hasEliminationCoverage(
  context: StepCompletionContext,
  scenarioResolution: readonly ScenarioResolutionResult[],
): boolean {
  const hasAlternativeStructure =
    context.hasCaseStructure ||
    scenarioResolution.length > 0 ||
    countMarkers(context.normalizedDraft, [
      "alternativa",
      "possibilidade",
      "caso",
      "cenario",
      "cenário",
      "alternative",
      "possibility",
      "case",
      "scenario",
    ]) >= 2;

  const allMentionedScenariosResolved =
    scenarioResolution.length === 0 ||
    scenarioResolution.every((scenario) => scenario.resolved);

  return (
    hasAlternativeStructure &&
    context.hasSupport &&
    context.hasExecutedElimination &&
    allMentionedScenariosResolved
  );
}

function hasDeterminationExecution(context: StepCompletionContext): boolean {
  const assignmentCount = Object.keys(context.assignmentExtractedAssignments).length;

  const enoughAssignments =
    context.representation.domainMapping?.variables?.length
      ? assignmentCount >= context.representation.domainMapping.variables.length
      : assignmentCount > 0;

  return (
    enoughAssignments &&
    context.assignmentPassed &&
    context.hasAssignmentStructure
  );
}

function constraintsSufficientlyReferenced(context: StepCompletionContext): boolean {
  const constraints = safeStringArray(context.representation.explicitConstraints);

  if (constraints.length === 0) {
    return true;
  }

  const covered = constraints.filter((constraint) =>
    hasSemanticOverlap(constraint, context.normalizedDraft, 0.24),
  );

  return covered.length >= Math.ceil(constraints.length * 0.5);
}

function hasGenericConclusionWithoutMapping(context: StepCompletionContext): boolean {
  const requiresAssignmentOutput =
    Boolean(context.representation.domainMapping) ||
    containsAny(
      [
        ...safeStringArray(context.representation.completionObligations),
        ...safeStringArray(context.representation.closureRequirements),
        ...safeStringArray(context.representation.invariants),
        context.representation.logicalProblemKind ?? "",
      ].join(" "),
      ASSIGNMENT_REQUIREMENT_MARKERS,
    );

  if (!requiresAssignmentOutput) {
    return false;
  }

  if (!context.hasConclusion && !context.hasDeterminationPromise) {
    return false;
  }

  if (
    context.unresolvedVariables.length === 0 &&
    context.assignmentMissingVariables.length === 0 &&
    context.assignmentRuleViolations.length === 0 &&
    context.assignmentPassed
  ) {
    return false;
  }

  return !context.hasAssignmentStructure;
}

function hasStartedSequenceButNotCompleted(context: StepCompletionContext): boolean {
  const hasStart = containsAny(context.normalizedDraft, SEQUENTIAL_START_MARKERS);
  const hasContinuation = containsAny(
    context.normalizedDraft,
    SEQUENTIAL_CONTINUATION_MARKERS,
  );

  if (!hasStart) {
    return false;
  }

  const hasMultipleObligations =
    context.representation.completionObligations.length > 1 ||
    context.scenarios.length > 1 ||
    context.unresolvedVariables.length > 0 ||
    context.assignmentMissingVariables.length > 0;

  return hasMultipleObligations && !hasContinuation && !context.hasConclusion;
}

function hasFormalReasoningObligations(context: StepCompletionContext): boolean {
  return (
    context.representation.explicitConstraints.length > 0 ||
    context.representation.completionObligations.length > 1 ||
    context.scenarios.length > 0 ||
    context.unresolvedVariables.length > 0 ||
    Boolean(context.representation.actionBudget) ||
    (context.representation.observationLimits ?? []).length > 0 ||
    Boolean(context.representation.domainMapping)
  );
}

function hasAssignmentStructure(draft: string): boolean {
  return (
    /\b[a-zA-ZÀ-ÿ0-9_.:-]{1,50}\s*(?:=|->|=>|:)\s*[a-zA-ZÀ-ÿ0-9_.:-]{1,80}\b/.test(draft) ||
    /(^|\n)\s*[-*]\s+[a-zA-ZÀ-ÿ0-9_.:-]{1,50}\s*[:=-]/m.test(draft) ||
    /\|[^|\n]+?\|[^|\n]+?\|/.test(draft) ||
    /\b(corresponde a|recebe|fica com|mapeia para|associado a|associada a|maps to|assigned to|corresponds to)\b/i.test(
      draft,
    )
  );
}

function detectContradictions(normalizedDraft: string): string[] {
  const contradictions: string[] = [];

  for (const pair of CONTRADICTION_PAIRS) {
    if (
      containsAny(normalizedDraft, pair.left) &&
      containsAny(normalizedDraft, pair.right)
    ) {
      contradictions.push(pair.id);
    }
  }

  return dedupe(contradictions);
}

function safeDetectActionBudgetViolation(
  representation: ProblemRepresentation,
  draftAnswer: string,
): { violated: boolean; reasons: string[] } {
  try {
    const result = detectActionBudgetViolation(
      representation.actionBudget,
      draftAnswer,
    );

    return {
      violated: Boolean(result?.violated),
      reasons: safeStringArray(result?.reasons),
    };
  } catch {
    return {
      violated: false,
      reasons: [],
    };
  }
}

function safeDetectObservationLimitViolation(
  representation: ProblemRepresentation,
  draftAnswer: string,
): { violated: boolean; reasons: string[] } {
  try {
    const result = detectObservationLimitViolation(
      representation.observationLimits,
      draftAnswer,
    );

    return {
      violated: Boolean(result?.violated),
      reasons: safeStringArray(result?.reasons),
    };
  } catch {
    return {
      violated: false,
      reasons: [],
    };
  }
}

function safeDetectUnresolvedAssignments(
  representation: ProblemRepresentation,
  draftAnswer: string,
): {
  missingVariables: string[];
  duplicateAssignments: string[];
  violatedAssignmentRules: string[];
} {
  try {
    const result = detectUnresolvedAssignments(
      representation.domainMapping,
      draftAnswer,
    );

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

function readBranchFailures(raw: AssignmentConsistencyResult): {
  branchIds: string[];
  missingVariables: string[];
} {
  const record = asRecord(raw);
  const branchCoverage = record.branchAssignmentCoverage;

  if (!Array.isArray(branchCoverage)) {
    return {
      branchIds: [],
      missingVariables: [],
    };
  }

  const branchIds: string[] = [];
  const missingVariables: string[] = [];

  for (const entry of branchCoverage) {
    const item = asRecord(entry);
    const branchId = readString(item, "branchId");
    const passed = item.passed === true;

    if (!passed && branchId) {
      branchIds.push(branchId);
    }

    missingVariables.push(
      ...readStringArray(item, "missingVariables").map((variable) =>
        branchId ? `${branchId}:${variable}` : variable,
      ),
    );
  }

  return {
    branchIds: dedupe(branchIds),
    missingVariables: dedupe(missingVariables),
  };
}

function readRecordField(
  source: unknown,
  key: string,
): Record<string, string> {
  const record = asRecord(source);
  const value = record[key];

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, string> = {};

  for (const [entryKey, entryValue] of Object.entries(value)) {
    const normalizedKey = normalize(entryKey);
    const normalizedValue = normalize(String(entryValue ?? ""));

    if (!normalizedKey || !normalizedValue) {
      continue;
    }

    result[normalizedKey] = normalizedValue;
  }

  return result;
}

function extractUsefulScenarioTokens(value: string): string[] {
  return dedupe(
    tokenize(value)
      .filter((token) => token.length >= 3)
      .filter((token) => !GENERIC_SCENARIO_TOKENS.has(token))
      .filter((token) => !STOPWORDS.has(token)),
  ).slice(0, 12);
}

function hasCaseStructureFromText(text: string): boolean {
  return countMarkers(text, CASE_MARKERS) >= 2;
}

function buildRisks(input: {
  context: StepCompletionContext;
  unresolvedScenarios: readonly string[];
  unsupportedConclusions: readonly string[];
  contradictions: readonly string[];
  prematureClosureDetected: boolean;
}): ReasoningRisk[] {
  const {
    context,
    unresolvedScenarios,
    unsupportedConclusions,
    contradictions,
    prematureClosureDetected,
  } = input;

  const risks: ReasoningRisk[] = [];

  if (unresolvedScenarios.length > 0) {
    risks.push({
      type: "incomplete_case_analysis",
      severity: unresolvedScenarios.length > 1 ? "high" : "medium",
      message: `Unresolved scenarios: ${unresolvedScenarios.join(", ")}`,
    });
  }

  if (context.unresolvedVariables.length > 0) {
    risks.push({
      type: "unresolved_variable",
      severity: context.unresolvedVariables.length > 2 ? "high" : "medium",
      message: `Unresolved variables: ${context.unresolvedVariables.join(", ")}`,
    });
  }

  if (unsupportedConclusions.length > 0) {
    risks.push({
      type: "unsupported_conclusion",
      severity: "high",
      message: `Unsupported conclusions: ${unsupportedConclusions.join(" | ")}`,
    });
  }

  if (context.hasDeterminationPromise && !hasDeterminationExecution(context)) {
    risks.push({
      type: "unsupported_conclusion",
      severity: "high",
      message:
        "Draft promises determination or elimination but does not execute complete scenario or assignment closure.",
    });
  }

  if (context.actionBudgetViolated) {
    risks.push({
      type: "abandoned_constraint",
      severity: "high",
      message: `Operation budget violation in draft: ${
        context.actionBudgetReasons.join(" | ") || "limited operation expanded"
      }`,
    });
  }

  if (context.observationLimitViolated) {
    risks.push({
      type: "abandoned_constraint",
      severity: "high",
      message: `Observation/access limit violation in draft: ${
        context.observationLimitReasons.join(" | ") ||
        "disallowed information access"
      }`,
    });
  }

  if (context.assignmentRuleViolations.length > 0) {
    risks.push({
      type: "unsupported_conclusion",
      severity: "high",
      message: `Assignment rule violations: ${context.assignmentRuleViolations.join(
        " | ",
      )}`,
    });
  }

  if (context.assignmentBranchFailures.length > 0) {
    risks.push({
      type: "incomplete_case_analysis",
      severity: "high",
      message: `Branch assignments incomplete: ${context.assignmentBranchFailures.join(
        " | ",
      )}`,
    });
  }

  if (contradictions.length > 0) {
    risks.push({
      type: "unsupported_conclusion",
      severity: "high",
      message: `Contradictions detected: ${contradictions.join(", ")}`,
    });
  }

  if (prematureClosureDetected) {
    risks.push({
      type: "premature_closure",
      severity: "high",
      message:
        "Draft appears to stop before fully closing required reasoning obligations.",
    });
  }

  return dedupeRisks(risks);
}

function hasMeaningfulReference(
  value: string,
  reference: string,
  minOverlap = 0.5,
): boolean {
  const normalizedValue = normalize(value);
  const normalizedReference = normalize(reference);

  if (!normalizedValue || !normalizedReference) {
    return false;
  }

  if (normalizedReference.includes(normalizedValue)) {
    return true;
  }

  const valueTokens = tokenize(normalizedValue)
    .filter((token) => !STOPWORDS.has(token))
    .filter((token) => !GENERIC_SCENARIO_TOKENS.has(token));

  const referenceTokens = new Set(
    tokenize(normalizedReference)
      .filter((token) => !STOPWORDS.has(token)),
  );

  if (valueTokens.length === 0 || referenceTokens.size === 0) {
    return false;
  }

  const overlap = valueTokens.filter((token) =>
    referenceTokens.has(token),
  ).length;

  return overlap / Math.max(1, valueTokens.length) >= minOverlap;
}

function hasSemanticOverlap(
  candidate: string,
  reference: string,
  minOverlap = 0.3,
): boolean {
  const left = new Set(tokenize(candidate));
  const right = new Set(tokenize(reference));

  if (left.size === 0 || right.size === 0) {
    return false;
  }

  let overlap = 0;

  for (const token of left) {
    if (right.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(1, Math.min(left.size, right.size)) >= minOverlap;
}

function countMarkers(text: string, markers: readonly string[]): number {
  return markers.reduce(
    (count, marker) => count + countMarker(text, marker),
    0,
  );
}

function countMarker(text: string, marker: string): number {
  const normalizedText = normalize(text);
  const normalizedMarker = normalize(marker);

  if (!normalizedText || !normalizedMarker) {
    return 0;
  }

  if (normalizedMarker.includes(" ")) {
    return normalizedText.match(new RegExp(escapeRegExp(normalizedMarker), "g"))
      ?.length ?? 0;
  }

  return normalizedText.match(
    new RegExp(`\\b${escapeRegExp(normalizedMarker)}\\b`, "g"),
  )?.length ?? 0;
}

function containsAny(text: string, markers: readonly string[]): boolean {
  const normalized = normalize(text);

  return markers.some((marker) => containsMarker(normalized, marker));
}

function containsMarker(text: string, marker: string): boolean {
  const normalizedText = normalize(text);
  const normalizedMarker = normalize(marker);

  if (!normalizedText || !normalizedMarker) {
    return false;
  }

  if (normalizedMarker.includes(" ")) {
    return normalizedText.includes(normalizedMarker);
  }

  return new RegExp(`\\b${escapeRegExp(normalizedMarker)}\\b`).test(
    normalizedText,
  );
}

function splitSentences(text: string): string[] {
  return String(text ?? "")
    .split(/[.!?;\n]+/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];

  return typeof value === "string" ? value : "";
}

function readStringArray(source: Record<string, unknown>, key: string): string[] {
  const value = source[key];

  return Array.isArray(value) ? safeStringArray(value) : [];
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

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : {};
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

function dedupeRisks(risks: readonly ReasoningRisk[]): ReasoningRisk[] {
  const byKey = new Map<string, ReasoningRisk>();

  for (const risk of risks) {
    const key = `${risk.type}:${risk.message}`.toLowerCase();
    const previous = byKey.get(key);

    if (!previous) {
      byKey.set(key, risk);
      continue;
    }

    byKey.set(key, moreSevereRisk(previous, risk));
  }

  return Array.from(byKey.values());
}

function moreSevereRisk(
  left: ReasoningRisk,
  right: ReasoningRisk,
): ReasoningRisk {
  return riskRank(right.severity) > riskRank(left.severity) ? right : left;
}

function riskRank(severity: ReasoningRisk["severity"]): number {
  if (severity === "high") return 2;
  if (severity === "medium") return 1;
  return 0;
}

function normalize(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "->")
    .replace(/[^a-z0-9_\s:.\-=|>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}