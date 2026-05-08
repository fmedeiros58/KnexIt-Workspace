/**
 * Layer: 14-reasoning-and-generation-layer/problem-resolution-core
 * Module: answer-draft-repair-planner
 * Responsibility: Produce repair instructions and lightweight deterministic repairs.
 */

import type {
  DraftRepairPlan,
  ProblemResolutionState,
} from "./problem-resolution-types";

type RepairMode = "none" | "light_repair" | "substantial_revision" | "regenerate";

interface ClosureSnapshot {
  readonly passed: boolean;
  readonly missingVariables: string[];
  readonly violatedConstraints: string[];
  readonly unresolvedScenarios: string[];
  readonly unsupportedConclusions: string[];
  readonly contradictions: string[];
}

interface FormalRepairSignals {
  readonly actionBudgetSignals: string[];
  readonly actionBudgetViolations: string[];

  readonly observationLimitSignals: string[];
  readonly observationLimitViolations: string[];

  readonly missingScenarioBranches: string[];
  readonly partiallyCoveredScenarioBranches: string[];
  readonly unresolvedScenarioBranches: string[];
  readonly scenarioBranchFailures: string[];
  readonly coveredScenarioBranches: string[];

  readonly missingAssignments: string[];
  readonly duplicateAssignments: string[];
  readonly violatedAssignmentRules: string[];
  readonly branchAssignmentFailures: string[];
  readonly branchMissingAssignments: string[];
  readonly unassignedByBranch: string[];

  readonly proofObligations: string[];
  readonly missingProofObligations: string[];

  readonly promiseWithoutExecutionSignals: string[];
  readonly scenarioNotClosedSignals: string[];
  readonly assignmentNotClosedSignals: string[];
}

interface RepairSnapshot {
  readonly closure: ClosureSnapshot;

  readonly missingObligations: string[];

  readonly explicitConstraints: string[];
  readonly implicitConstraints: string[];
  readonly invariants: string[];
  readonly completionObligations: string[];
  readonly scenarioBranches: string[];
  readonly closureRequirements: string[];

  readonly formal: FormalRepairSignals;
}

const REPAIR_TAIL_HEADING = "Complemento de fechamento lógico:";

const REPAIR_TAIL_PATTERN =
  /\n{0,3}Complemento de fechamento lógico:[\s\S]*$/i;

const OPERATION_LIMIT_FALLBACK_MARKERS = [
  "apenas uma",
  "apenas um",
  "somente uma",
  "somente um",
  "uma unica",
  "uma única",
  "um unico",
  "um único",
  "uma vez",
  "only one",
  "single",
  "one single",
  "exactly one",
  "at most one",
];

const OBSERVATION_LIMIT_FALLBACK_MARKERS = [
  "sem olhar",
  "nao olhar",
  "não olhar",
  "sem ver",
  "nao ver",
  "não ver",
  "sem observar",
  "sem verificar",
  "without looking",
  "without seeing",
  "without observing",
  "without checking",
];

const OPERATION_VIOLATION_KEYS = [
  "action_budget",
  "operation_budget",
  "single_action",
  "single_operation",
  "forbidden_action",
  "forbidden_operation",
  "repeated_action",
  "repeated_operation",
  "maxactions",
  "max_operations",
  "repeatallowed",
  "repeat_allowed",
  "formal_operation_budget_violation",
];

const OBSERVATION_VIOLATION_KEYS = [
  "observation_limit",
  "hidden_inspection",
  "additional_observation",
  "forbidden_observation",
  "forbidden_inspection",
  "no_hidden_inspection",
  "single_observation",
  "formal_observation_limit_violation",
];

const SCENARIO_KEYS = [
  "scenario",
  "branch",
  "case_analysis",
  "case analysis",
  "unresolved scenario",
  "unresolved_scenario",
  "missing branch",
  "missing_branch",
  "scenario_coverage_failed",
  "scenario_mentioned_but_not_resolved",
  "case_analysis_started_but_not_closed",
  "conclusion_before_scenario_closure",
];

const ASSIGNMENT_KEYS = [
  "assignment",
  "mapping",
  "unassigned",
  "missing assignment",
  "missing_assignment",
  "duplicate assignment",
  "duplicate_assignment",
  "variable not resolved",
  "unresolved_variable",
  "assignment_consistency_failed",
  "assignment_consistency_not_satisfied",
  "assignment_variables_not_fully_resolved",
  "branch_assignments_not_fully_resolved",
  "branch_variables_missing_assignment",
];

const PROOF_KEYS = [
  "proof",
  "proof_obligation",
  "support_conclusion",
  "support final conclusion",
  "justify",
  "validate",
  "closure requirement",
  "proof_obligations_not_fully_satisfied",
];

const PROMISE_WITHOUT_EXECUTION_KEYS = [
  "determination_promised_but_not_executed",
  "assignment_promised_but_not_executed",
  "elimination_mentioned_but_not_executed",
  "elimination_claim_without_executed_elimination",
  "scenario_promised_but_not_executed",
  "branch_promised_but_not_resolved",
];

const SCENARIO_NOT_CLOSED_KEYS = [
  "scenario_mentioned_but_not_resolved",
  "case_analysis_started_but_not_closed",
  "conclusion_before_scenario_closure",
  "scenario_branch_not_fully_assigned",
  "branch_assignments_not_fully_resolved",
  "branch_variables_missing_assignment",
  "partially_covered",
];

const ASSIGNMENT_NOT_CLOSED_KEYS = [
  "assignment_consistency_not_satisfied",
  "assignment_variables_not_fully_resolved",
  "claimed_full_determination_without_full_assignment",
  "generic_conclusion_without_mapping_structure",
  "complete_assignment_required",
  "scenario_assignments_incomplete",
  "branch_assignment_incomplete",
];

export function buildAnswerDraftRepairPlan(
  state: ProblemResolutionState,
): DraftRepairPlan {
  const snapshot = buildRepairSnapshot(state);

  const repairReasons: string[] = [];
  const repairInstructions: string[] = [];

  addClosureReasons(snapshot, repairReasons);
  addConstraintReasons(snapshot, repairReasons);
  addObligationReasons(snapshot, repairReasons);
  addFormalReasoningReasons(snapshot, repairReasons);
  addPromiseFailureReasons(snapshot, repairReasons);

  addClosureInstructions(snapshot, repairInstructions);
  addConstraintInstructions(snapshot, repairInstructions);
  addScenarioInstructions(snapshot, repairInstructions);
  addAssignmentInstructions(snapshot, repairInstructions);
  addProofInstructions(snapshot, repairInstructions);
  addPromiseFailureInstructions(snapshot, repairInstructions);
  addConclusionInstructions(snapshot, repairInstructions);
  addContradictionInstructions(snapshot, repairInstructions);

  const requiresRepair =
    repairReasons.length > 0 ||
    repairInstructions.length > 0 ||
    !snapshot.closure.passed;

  const repairMode = deriveRepairMode(snapshot, requiresRepair);

  return {
    requiresRepair,
    repairReasons: dedupe(repairReasons),
    repairInstructions: dedupe(repairInstructions),
    repairMode,
  } as DraftRepairPlan;
}

export function applyProblemResolutionRepair(
  draftAnswer: string,
  state: ProblemResolutionState,
  plan: DraftRepairPlan,
): string {
  const draft = String(draftAnswer ?? "").trim();

  if (!draft) {
    return "";
  }

  const cleanedDraft = stripExistingRepairTail(stabilizeParagraphs(draft));

  if (!plan.requiresRepair) {
    return cleanedDraft;
  }

  const repairTail = buildRepairTail(state, plan);

  if (!repairTail) {
    return cleanedDraft;
  }

  return `${cleanedDraft}\n\n${repairTail}`.trim();
}

function buildRepairSnapshot(state: ProblemResolutionState): RepairSnapshot {
  const closure: ClosureSnapshot = {
    passed: getNestedBoolean(state, ["closure", "passed"], true),
    missingVariables: getNestedStringArray(state, ["closure", "missingVariables"]),
    violatedConstraints: getNestedStringArray(state, ["closure", "violatedConstraints"]),
    unresolvedScenarios: getNestedStringArray(state, ["closure", "unresolvedScenarios"]),
    unsupportedConclusions: getNestedStringArray(state, ["closure", "unsupportedConclusions"]),
    contradictions: getNestedStringArray(state, ["closure", "contradictions"]),
  };

  return {
    closure,

    missingObligations: dedupe([
      ...getNestedStringArray(state, ["report", "missingObligations"]),
      ...getNestedStringArray(state, ["report", "missingProofObligations"]),
    ]),

    explicitConstraints: dedupe([
      ...getNestedStringArray(state, ["explicitConstraints"]),
      ...getNestedStringArray(state, ["constraints", "explicit"]),
      ...getNestedStringArray(state, ["representation", "explicitConstraints"]),
    ]),

    implicitConstraints: dedupe([
      ...getNestedStringArray(state, ["implicitConstraints"]),
      ...getNestedStringArray(state, ["constraints", "implicit"]),
      ...getNestedStringArray(state, ["representation", "implicitConstraints"]),
    ]),

    invariants: dedupe([
      ...getNestedStringArray(state, ["invariants"]),
      ...getNestedStringArray(state, ["representation", "invariants"]),
    ]),

    completionObligations: dedupe([
      ...getNestedStringArray(state, ["completionObligations"]),
      ...getNestedStringArray(state, ["report", "completionObligations"]),
      ...getNestedStringArray(state, ["representation", "completionObligations"]),
    ]),

    scenarioBranches: dedupe([
      ...getNestedStringArray(state, ["scenarioBranches"]),
      ...getNestedStringArray(state, ["scenarios"]),
      ...getNestedStringArray(state, ["representation", "scenarioBranches"]),
      ...getNestedStringArray(state, ["representation", "scenarios"]),
      ...getNestedStringArray(state, ["closure", "unresolvedScenarios"]),
    ]),

    closureRequirements: dedupe([
      ...getNestedStringArray(state, ["closureRequirements"]),
      ...getNestedStringArray(state, ["report", "closureRequirements"]),
      ...getNestedStringArray(state, ["representation", "closureRequirements"]),
    ]),

    formal: buildFormalRepairSignals(state, closure),
  };
}

function buildFormalRepairSignals(
  state: ProblemResolutionState,
  closure: ClosureSnapshot,
): FormalRepairSignals {
  const actionBudgetSignals = dedupe([
    ...extractActionBudgetSignals(state, ["actionBudget"]),
    ...extractActionBudgetSignals(state, ["representation", "actionBudget"]),
    ...findConstraintSignals(state, OPERATION_LIMIT_FALLBACK_MARKERS),
  ]);

  const actionBudgetViolations = dedupe([
    ...extractViolationObjectSignals(state, ["actionBudgetViolation"]),
    ...extractViolationObjectSignals(state, ["report", "actionBudgetViolation"]),
    ...filterByKeys(closure.violatedConstraints, OPERATION_VIOLATION_KEYS),
  ]);

  const observationLimitSignals = dedupe([
    ...extractObservationLimitSignals(state, ["observationLimits"]),
    ...extractObservationLimitSignals(state, ["representation", "observationLimits"]),
    ...findConstraintSignals(state, OBSERVATION_LIMIT_FALLBACK_MARKERS),
  ]);

  const observationLimitViolations = dedupe([
    ...extractViolationObjectSignals(state, ["observationLimitViolation"]),
    ...extractViolationObjectSignals(state, ["report", "observationLimitViolation"]),
    ...filterByKeys(closure.violatedConstraints, OBSERVATION_VIOLATION_KEYS),
  ]);

  const missingScenarioBranches = dedupe([
    ...getNestedStringArray(state, ["scenarioCoverage", "missingBranches"]),
    ...getNestedStringArray(state, ["report", "scenarioCoverage", "missingBranches"]),
    ...getNestedStringArray(state, ["closure", "unresolvedScenarios"]),
    ...filterByKeys(closure.unresolvedScenarios, SCENARIO_KEYS),
    ...filterByKeys(closure.violatedConstraints, SCENARIO_KEYS),
  ]);

  const partiallyCoveredScenarioBranches = dedupe([
    ...getNestedStringArray(state, ["scenarioCoverage", "partiallyCoveredBranches"]),
    ...getNestedStringArray(state, ["scenarioCoverage", "unresolvedBranches"]),
    ...getNestedStringArray(state, ["report", "scenarioCoverage", "partiallyCoveredBranches"]),
    ...getNestedStringArray(state, ["report", "scenarioCoverage", "unresolvedBranches"]),
  ]);

  const unresolvedScenarioBranches = dedupe([
    ...getNestedStringArray(state, ["scenarioCoverage", "unresolvedBranches"]),
    ...getNestedStringArray(state, ["report", "scenarioCoverage", "unresolvedBranches"]),
  ]);

  const scenarioBranchFailures = dedupe([
    ...flattenRecordOfStringArrays(
      getNestedUnknown(state, ["scenarioCoverage", "branchFailures"]),
    ),
    ...flattenRecordOfStringArrays(
      getNestedUnknown(state, ["report", "scenarioCoverage", "branchFailures"]),
    ),
  ]);

  const coveredScenarioBranches = dedupe([
    ...getNestedStringArray(state, ["scenarioCoverage", "coveredBranches"]),
    ...getNestedStringArray(state, ["report", "scenarioCoverage", "coveredBranches"]),
  ]);

  const missingAssignments = dedupe([
    ...getNestedStringArray(state, ["assignmentConsistency", "missingAssignments"]),
    ...getNestedStringArray(state, ["report", "assignmentConsistency", "missingAssignments"]),
    ...filterByKeys(closure.missingVariables, ASSIGNMENT_KEYS),
    ...filterByKeys(closure.violatedConstraints, ASSIGNMENT_KEYS),
  ]);

  const duplicateAssignments = dedupe([
    ...getNestedStringArray(state, ["assignmentConsistency", "duplicateAssignments"]),
    ...getNestedStringArray(state, ["report", "assignmentConsistency", "duplicateAssignments"]),
  ]);

  const violatedAssignmentRules = dedupe([
    ...getNestedStringArray(state, ["assignmentConsistency", "violatedAssignmentRules"]),
    ...getNestedStringArray(state, ["report", "assignmentConsistency", "violatedAssignmentRules"]),
  ]);

  const branchAssignmentFailures = dedupe([
    ...extractBranchAssignmentFailures(state, ["assignmentConsistency", "branchAssignmentCoverage"]),
    ...extractBranchAssignmentFailures(state, ["report", "assignmentConsistency", "branchAssignmentCoverage"]),
  ]);

  const branchMissingAssignments = dedupe([
    ...extractBranchMissingAssignments(state, ["assignmentConsistency", "branchAssignmentCoverage"]),
    ...extractBranchMissingAssignments(state, ["report", "assignmentConsistency", "branchAssignmentCoverage"]),
  ]);

  const unassignedByBranch = dedupe([
    ...flattenRecordOfStringArrays(getNestedUnknown(state, ["assignmentConsistency", "unassignedByBranch"])),
    ...flattenRecordOfStringArrays(getNestedUnknown(state, ["report", "assignmentConsistency", "unassignedByBranch"])),
  ]);

  const proofObligations = dedupe([
    ...extractProofObligationDescriptions(state, ["proofObligations"]),
    ...extractProofObligationDescriptions(state, ["representation", "proofObligations"]),
    ...getNestedStringArray(state, ["proofObligations"]),
    ...getNestedStringArray(state, ["representation", "proofObligations"]),
  ]);

  const missingProofObligations = dedupe([
    ...getNestedStringArray(state, ["report", "missingProofObligations"]),
    ...getNestedStringArray(state, ["missingProofObligations"]),
    ...getNestedStringArray(state, ["proofEvaluation", "missing"]),
    ...getNestedStringArray(state, ["report", "proofEvaluation", "missing"]),
    ...extractUnsatisfiedProofObligations(state, ["proofObligations"]),
    ...extractUnsatisfiedProofObligations(state, ["representation", "proofObligations"]),
    ...filterByKeys(closure.unsupportedConclusions, PROOF_KEYS),
    ...filterByKeys(closure.violatedConstraints, PROOF_KEYS),
  ]);

  const promiseWithoutExecutionSignals = dedupe([
    ...filterByKeys(closure.unsupportedConclusions, PROMISE_WITHOUT_EXECUTION_KEYS),
    ...filterByKeys(closure.violatedConstraints, PROMISE_WITHOUT_EXECUTION_KEYS),
  ]);

  const scenarioNotClosedSignals = dedupe([
    ...filterByKeys(closure.unsupportedConclusions, SCENARIO_NOT_CLOSED_KEYS),
    ...filterByKeys(closure.unresolvedScenarios, SCENARIO_NOT_CLOSED_KEYS),
    ...partiallyCoveredScenarioBranches,
    ...unresolvedScenarioBranches,
  ]);

  const assignmentNotClosedSignals = dedupe([
    ...filterByKeys(closure.unsupportedConclusions, ASSIGNMENT_NOT_CLOSED_KEYS),
    ...filterByKeys(closure.missingVariables, ASSIGNMENT_NOT_CLOSED_KEYS),
    ...branchAssignmentFailures,
    ...branchMissingAssignments,
    ...unassignedByBranch,
  ]);

  return {
    actionBudgetSignals,
    actionBudgetViolations,

    observationLimitSignals,
    observationLimitViolations,

    missingScenarioBranches,
    partiallyCoveredScenarioBranches,
    unresolvedScenarioBranches,
    scenarioBranchFailures,
    coveredScenarioBranches,

    missingAssignments,
    duplicateAssignments,
    violatedAssignmentRules,
    branchAssignmentFailures,
    branchMissingAssignments,
    unassignedByBranch,

    proofObligations,
    missingProofObligations,

    promiseWithoutExecutionSignals,
    scenarioNotClosedSignals,
    assignmentNotClosedSignals,
  };
}

function addClosureReasons(
  snapshot: RepairSnapshot,
  repairReasons: string[],
): void {
  if (!snapshot.closure.passed) {
    repairReasons.push("Reasoning closure failed.");
  }

  if (snapshot.closure.missingVariables.length > 0) {
    repairReasons.push(
      `Missing variables: ${snapshot.closure.missingVariables.join(", ")}`,
    );
  }

  if (snapshot.closure.unresolvedScenarios.length > 0) {
    repairReasons.push(
      `Unresolved scenarios: ${snapshot.closure.unresolvedScenarios.join(" | ")}`,
    );
  }

  if (snapshot.closure.unsupportedConclusions.length > 0) {
    repairReasons.push(
      `Unsupported conclusions: ${snapshot.closure.unsupportedConclusions.join(" | ")}`,
    );
  }

  if (snapshot.closure.contradictions.length > 0) {
    repairReasons.push(
      `Contradictions: ${snapshot.closure.contradictions.join(" | ")}`,
    );
  }
}

function addConstraintReasons(
  snapshot: RepairSnapshot,
  repairReasons: string[],
): void {
  if (snapshot.closure.violatedConstraints.length > 0) {
    repairReasons.push(
      `Violated constraints: ${snapshot.closure.violatedConstraints.join(" | ")}`,
    );
  }

  if (hasActionBudgetViolation(snapshot)) {
    repairReasons.push(
      `Operation-budget violation detected: ${snapshot.formal.actionBudgetViolations.join(" | ")}`,
    );
  }

  if (hasObservationLimitViolation(snapshot)) {
    repairReasons.push(
      `Observation-limit violation detected: ${snapshot.formal.observationLimitViolations.join(" | ")}`,
    );
  }
}

function addObligationReasons(
  snapshot: RepairSnapshot,
  repairReasons: string[],
): void {
  if (snapshot.missingObligations.length > 0 && !snapshot.closure.passed) {
    repairReasons.push(
      `Missing obligations: ${snapshot.missingObligations.join(" | ")}`,
    );
  }

  if (snapshot.formal.missingProofObligations.length > 0) {
    repairReasons.push(
      `Missing proof obligations: ${snapshot.formal.missingProofObligations.join(" | ")}`,
    );
  }

  if (snapshot.completionObligations.length > 0 && !snapshot.closure.passed) {
    repairReasons.push(
      `Completion obligations still require verification: ${snapshot.completionObligations.join(" | ")}`,
    );
  }

  if (snapshot.closureRequirements.length > 0 && !snapshot.closure.passed) {
    repairReasons.push(
      `Closure requirements still require verification: ${snapshot.closureRequirements.join(" | ")}`,
    );
  }
}

function addFormalReasoningReasons(
  snapshot: RepairSnapshot,
  repairReasons: string[],
): void {
  if (snapshot.formal.missingScenarioBranches.length > 0) {
    repairReasons.push(
      `Scenario coverage incomplete: ${snapshot.formal.missingScenarioBranches.join(" | ")}`,
    );
  }

  if (snapshot.formal.partiallyCoveredScenarioBranches.length > 0) {
    repairReasons.push(
      `Scenario branches mentioned but not resolved: ${snapshot.formal.partiallyCoveredScenarioBranches.join(" | ")}`,
    );
  }

  if (snapshot.formal.scenarioBranchFailures.length > 0) {
    repairReasons.push(
      `Scenario branch failures: ${snapshot.formal.scenarioBranchFailures.join(" | ")}`,
    );
  }

  if (snapshot.formal.missingAssignments.length > 0) {
    repairReasons.push(
      `Assignments missing: ${snapshot.formal.missingAssignments.join(" | ")}`,
    );
  }

  if (snapshot.formal.branchAssignmentFailures.length > 0) {
    repairReasons.push(
      `Branch assignments incomplete: ${snapshot.formal.branchAssignmentFailures.join(" | ")}`,
    );
  }

  if (snapshot.formal.branchMissingAssignments.length > 0) {
    repairReasons.push(
      `Branch assignment variables missing: ${snapshot.formal.branchMissingAssignments.join(" | ")}`,
    );
  }

  if (snapshot.formal.duplicateAssignments.length > 0) {
    repairReasons.push(
      `Duplicate assignments detected: ${snapshot.formal.duplicateAssignments.join(" | ")}`,
    );
  }

  if (snapshot.formal.violatedAssignmentRules.length > 0) {
    repairReasons.push(
      `Assignment rules violated: ${snapshot.formal.violatedAssignmentRules.join(" | ")}`,
    );
  }
}

function addPromiseFailureReasons(
  snapshot: RepairSnapshot,
  repairReasons: string[],
): void {
  if (snapshot.formal.promiseWithoutExecutionSignals.length > 0) {
    repairReasons.push(
      `Resolution was promised but not executed: ${snapshot.formal.promiseWithoutExecutionSignals.join(" | ")}`,
    );
  }

  if (snapshot.formal.scenarioNotClosedSignals.length > 0) {
    repairReasons.push(
      `Scenario reasoning was not closed: ${snapshot.formal.scenarioNotClosedSignals.join(" | ")}`,
    );
  }

  if (snapshot.formal.assignmentNotClosedSignals.length > 0) {
    repairReasons.push(
      `Assignment reasoning was not closed: ${snapshot.formal.assignmentNotClosedSignals.join(" | ")}`,
    );
  }
}

function deriveRepairMode(
  snapshot: RepairSnapshot,
  requiresRepair: boolean,
): RepairMode {
  if (!requiresRepair) {
    return "none";
  }

  const hasForbiddenOperationFailure =
    hasActionBudgetViolation(snapshot) ||
    hasObservationLimitViolation(snapshot);

  const hasStructuralClosureFailure =
    snapshot.closure.violatedConstraints.length > 0 ||
    snapshot.closure.contradictions.length > 0;

  const hasMissingReasoningCoverage =
    snapshot.closure.unresolvedScenarios.length > 0 ||
    snapshot.formal.missingScenarioBranches.length > 0 ||
    snapshot.formal.partiallyCoveredScenarioBranches.length > 0 ||
    snapshot.formal.scenarioBranchFailures.length > 0 ||
    snapshot.formal.missingAssignments.length > 0 ||
    snapshot.formal.branchAssignmentFailures.length > 0 ||
    snapshot.formal.branchMissingAssignments.length > 0 ||
    snapshot.formal.violatedAssignmentRules.length > 0 ||
    snapshot.formal.missingProofObligations.length > 0;

  const hasUnsupportedFinality =
    snapshot.closure.unsupportedConclusions.length > 0 ||
    snapshot.closure.missingVariables.length > 0 ||
    snapshot.formal.promiseWithoutExecutionSignals.length > 0 ||
    snapshot.formal.scenarioNotClosedSignals.length > 0 ||
    snapshot.formal.assignmentNotClosedSignals.length > 0;

  if (
    hasForbiddenOperationFailure ||
    (hasStructuralClosureFailure && hasMissingReasoningCoverage) ||
    (hasStructuralClosureFailure && hasUnsupportedFinality) ||
    (hasMissingReasoningCoverage && hasUnsupportedFinality)
  ) {
    return "regenerate";
  }

  if (
    hasStructuralClosureFailure ||
    hasMissingReasoningCoverage ||
    hasUnsupportedFinality ||
    snapshot.missingObligations.length > 0
  ) {
    return "substantial_revision";
  }

  return "light_repair";
}

function addClosureInstructions(
  snapshot: RepairSnapshot,
  repairInstructions: string[],
): void {
  if (!snapshot.closure.passed) {
    repairInstructions.push(
      "Do not finalize the answer until every required variable, constraint, scenario, proof obligation and conclusion has been checked.",
    );
    repairInstructions.push(
      "Add an explicit closure step confirming that the user's objective has been satisfied without violating any constraint.",
    );
  }

  if (snapshot.closure.missingVariables.length > 0) {
    repairInstructions.push(
      "Resolve all missing variables before the final conclusion. Do not leave any entity, role, value, relation or assignment unmapped.",
    );
  }

  if (snapshot.missingObligations.length > 0 && !snapshot.closure.passed) {
    repairInstructions.push(
      "Satisfy all missing obligations from the task contract before delivering the final answer.",
    );
  }
}

function addConstraintInstructions(
  snapshot: RepairSnapshot,
  repairInstructions: string[],
): void {
  if (snapshot.closure.violatedConstraints.length > 0) {
    repairInstructions.push(
      "Rewrite the affected reasoning so that every explicit user constraint remains valid from the first step to the conclusion.",
    );
  }

  if (hasActionBudgetViolation(snapshot)) {
    repairInstructions.push(
      "Rebuild the solution without expanding a limited operation into repeated, sequential, universal or multi-target operations.",
    );
  }

  if (hasObservationLimitViolation(snapshot)) {
    repairInstructions.push(
      "Rebuild the solution without depending on observations, inspections, checks or hidden information that the task does not allow.",
    );
  }

  if (snapshot.explicitConstraints.length > 0) {
    repairInstructions.push(
      "Restate and preserve the explicit constraints that control the solution path.",
    );
  }

  if (snapshot.invariants.length > 0) {
    repairInstructions.push(
      "Preserve invariants, exclusivity rules and structural assumptions while assigning values or drawing conclusions.",
    );
  }
}

function addScenarioInstructions(
  snapshot: RepairSnapshot,
  repairInstructions: string[],
): void {
  if (
    snapshot.closure.unresolvedScenarios.length > 0 ||
    snapshot.formal.missingScenarioBranches.length > 0 ||
    snapshot.formal.partiallyCoveredScenarioBranches.length > 0 ||
    snapshot.formal.scenarioBranchFailures.length > 0 ||
    snapshot.scenarioBranches.length > 0
  ) {
    repairInstructions.push(
      "Enumerate every required scenario branch and resolve each branch before the final answer.",
    );
    repairInstructions.push(
      "Each scenario branch must contain a local consequence, not only a mention of the possible condition.",
    );
    repairInstructions.push(
      "For elimination reasoning, explicitly show which possibilities are impossible and what remains in each branch.",
    );
  }
}

function addAssignmentInstructions(
  snapshot: RepairSnapshot,
  repairInstructions: string[],
): void {
  if (
    snapshot.formal.missingAssignments.length > 0 ||
    snapshot.formal.duplicateAssignments.length > 0 ||
    snapshot.formal.violatedAssignmentRules.length > 0 ||
    snapshot.formal.branchAssignmentFailures.length > 0 ||
    snapshot.formal.branchMissingAssignments.length > 0 ||
    snapshot.formal.unassignedByBranch.length > 0
  ) {
    repairInstructions.push(
      "Produce a complete and consistent final mapping: every required variable must be assigned, no forbidden duplication may remain, and all assignment rules must be respected.",
    );
    repairInstructions.push(
      "When scenarios exist, provide complete assignments inside each relevant branch, not only a global or implied conclusion.",
    );
  }
}

function addProofInstructions(
  snapshot: RepairSnapshot,
  repairInstructions: string[],
): void {
  if (snapshot.formal.missingProofObligations.length > 0) {
    repairInstructions.push(
      "Satisfy every missing proof obligation before conclusion: preserve constraints, cover scenarios, justify elimination, validate mappings and support final claims.",
    );
  }

  if (snapshot.formal.proofObligations.length > 0 && !snapshot.closure.passed) {
    repairInstructions.push(
      "Use proof obligations as a checklist before approving the answer.",
    );
  }
}

function addPromiseFailureInstructions(
  snapshot: RepairSnapshot,
  repairInstructions: string[],
): void {
  if (snapshot.formal.promiseWithoutExecutionSignals.length > 0) {
    repairInstructions.push(
      "Do not say that something can be determined, inferred or eliminated unless the answer actually performs the determination, inference or elimination.",
    );
  }

  if (snapshot.formal.scenarioNotClosedSignals.length > 0) {
    repairInstructions.push(
      "Replace generic statements such as 'the rest follows' with explicit branch-by-branch reasoning.",
    );
  }

  if (snapshot.formal.assignmentNotClosedSignals.length > 0) {
    repairInstructions.push(
      "Replace implied assignments with explicit final assignments using a clear mapping format.",
    );
  }
}

function addConclusionInstructions(
  snapshot: RepairSnapshot,
  repairInstructions: string[],
): void {
  if (snapshot.closure.unsupportedConclusions.length > 0) {
    repairInstructions.push(
      "Ground every conclusion in explicit premises, constraints, scenario reasoning, assignment consistency or proof obligations.",
    );
  }

  if (
    snapshot.closure.missingVariables.length > 0 ||
    snapshot.closure.unresolvedScenarios.length > 0 ||
    snapshot.formal.missingAssignments.length > 0 ||
    snapshot.formal.missingScenarioBranches.length > 0 ||
    snapshot.formal.partiallyCoveredScenarioBranches.length > 0
  ) {
    repairInstructions.push(
      "Do not use a broad final claim unless all required variables, mappings and scenarios have been resolved.",
    );
  }
}

function addContradictionInstructions(
  snapshot: RepairSnapshot,
  repairInstructions: string[],
): void {
  if (snapshot.closure.contradictions.length > 0) {
    repairInstructions.push(
      "Remove contradictory statements and rebuild one coherent reasoning chain.",
    );
  }

  if (
    snapshot.closure.contradictions.length > 0 ||
    snapshot.closure.violatedConstraints.length > 0
  ) {
    repairInstructions.push(
      "Prefer regeneration over superficial patching when contradictions or violated constraints affect the core reasoning path.",
    );
  }
}

function buildRepairTail(
  state: ProblemResolutionState,
  plan: DraftRepairPlan,
): string {
  const snapshot = buildRepairSnapshot(state);
  const tail: string[] = [];
  const repairMode = getPlanRepairMode(plan);

  tail.push(`- Modo de reparo recomendado: ${repairMode}.`);

  if (snapshot.closure.missingVariables.length > 0) {
    tail.push(
      `- Variáveis ainda não cobertas: ${snapshot.closure.missingVariables.join(", ")}.`,
    );
  }

  if (snapshot.missingObligations.length > 0) {
    tail.push(
      `- Obrigações ainda pendentes: ${snapshot.missingObligations.join(" | ")}.`,
    );
  }

  if (snapshot.formal.missingProofObligations.length > 0) {
    tail.push(
      `- Obrigações de prova pendentes: ${snapshot.formal.missingProofObligations.join(" | ")}.`,
    );
  }

  if (snapshot.closure.violatedConstraints.length > 0) {
    tail.push(
      `- Restrições violadas que precisam ser preservadas: ${snapshot.closure.violatedConstraints.join(" | ")}.`,
    );
  }

  if (snapshot.closure.unresolvedScenarios.length > 0) {
    tail.push(
      `- Cenários pendentes que precisam ser resolvidos: ${snapshot.closure.unresolvedScenarios.join(" | ")}.`,
    );
  }

  if (snapshot.formal.partiallyCoveredScenarioBranches.length > 0) {
    tail.push(
      `- Ramos apenas mencionados, mas não resolvidos: ${snapshot.formal.partiallyCoveredScenarioBranches.join(" | ")}.`,
    );
  }

  if (snapshot.formal.missingScenarioBranches.length > 0) {
    tail.push(
      `- Ramos de cenário sem cobertura: ${snapshot.formal.missingScenarioBranches.join(" | ")}.`,
    );
  }

  if (snapshot.formal.missingAssignments.length > 0) {
    tail.push(
      `- Atribuições pendentes: ${snapshot.formal.missingAssignments.join(" | ")}.`,
    );
  }

  if (snapshot.formal.branchMissingAssignments.length > 0) {
    tail.push(
      `- Atribuições pendentes por ramo: ${snapshot.formal.branchMissingAssignments.join(" | ")}.`,
    );
  }

  if (snapshot.formal.duplicateAssignments.length > 0) {
    tail.push(
      `- Atribuições duplicadas a corrigir: ${snapshot.formal.duplicateAssignments.join(" | ")}.`,
    );
  }

  if (snapshot.formal.violatedAssignmentRules.length > 0) {
    tail.push(
      `- Regras de atribuição violadas: ${snapshot.formal.violatedAssignmentRules.join(" | ")}.`,
    );
  }

  if (snapshot.closure.unsupportedConclusions.length > 0) {
    tail.push(
      `- Conclusões sem sustentação suficiente: ${snapshot.closure.unsupportedConclusions.join(" | ")}.`,
    );
  }

  if (snapshot.formal.promiseWithoutExecutionSignals.length > 0) {
    tail.push(
      `- Há promessa de resolução sem execução efetiva: ${snapshot.formal.promiseWithoutExecutionSignals.join(" | ")}.`,
    );
  }

  if (snapshot.closure.contradictions.length > 0) {
    tail.push(
      `- Contradições a corrigir: ${snapshot.closure.contradictions.join(" | ")}.`,
    );
  }

  if (hasActionBudgetViolation(snapshot)) {
    tail.push(
      "- Há limite operacional violado. A resposta não pode transformar uma operação limitada em repetições, aplicações a todos, aplicações aos demais ou procedimento um a um.",
    );
  }

  if (hasObservationLimitViolation(snapshot)) {
    tail.push(
      "- Há limite de observação violado. A resposta não pode depender de informação adicional que o enunciado não permite observar.",
    );
  }

  const instructionTail = dedupe(plan.repairInstructions ?? []).slice(0, 10);

  for (const instruction of instructionTail) {
    tail.push(`- ${instruction}`);
  }

  if (tail.length <= 1 && repairMode === "none") {
    return "";
  }

  return `${REPAIR_TAIL_HEADING}\n${dedupe(tail).join("\n")}`;
}

function hasActionBudgetViolation(snapshot: RepairSnapshot): boolean {
  return snapshot.formal.actionBudgetViolations.length > 0;
}

function hasObservationLimitViolation(snapshot: RepairSnapshot): boolean {
  return snapshot.formal.observationLimitViolations.length > 0;
}

function stripExistingRepairTail(draft: string): string {
  return String(draft ?? "").replace(REPAIR_TAIL_PATTERN, "").trim();
}

function stabilizeParagraphs(text: string): string {
  const paragraphs = String(text ?? "")
    .split(/\n{2,}/g)
    .map((paragraph) =>
      paragraph
        .split(/\n/g)
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join(" "),
    )
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const result: string[] = [];

  for (const paragraph of paragraphs) {
    const key = normalizeText(paragraph);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(paragraph);
  }

  return result.join("\n\n").trim();
}

function getPlanRepairMode(plan: DraftRepairPlan): RepairMode {
  const value = getRecordString(plan, "repairMode");

  if (
    value === "none" ||
    value === "light_repair" ||
    value === "substantial_revision" ||
    value === "regenerate"
  ) {
    return value;
  }

  return plan.requiresRepair ? "light_repair" : "none";
}

function extractActionBudgetSignals(
  state: ProblemResolutionState,
  path: readonly string[],
): string[] {
  const value = getNestedUnknown(state, path);

  if (!isRecord(value)) {
    return [];
  }

  const signals: string[] = [];

  const maxActions = getRecordNumber(value, "maxActions");
  const targetLimit = getRecordNumber(value, "targetLimit");
  const repeatAllowed = getRecordBoolean(value, "repeatAllowed");

  if (typeof maxActions === "number") {
    signals.push(`actionBudget.maxActions=${maxActions}`);
  }

  if (typeof targetLimit === "number") {
    signals.push(`actionBudget.targetLimit=${targetLimit}`);
  }

  if (typeof repeatAllowed === "boolean") {
    signals.push(`actionBudget.repeatAllowed=${repeatAllowed}`);
  }

  signals.push(...getRecordStringArray(value, "rawSignals"));

  return dedupe(signals);
}

function extractObservationLimitSignals(
  state: ProblemResolutionState,
  path: readonly string[],
): string[] {
  const value = getNestedUnknown(state, path);

  if (Array.isArray(value)) {
    return dedupe(
      value.flatMap((entry) => {
        if (!isRecord(entry)) {
          return [String(entry ?? "")];
        }

        return [
          getRecordString(entry, "type"),
          getRecordString(entry, "scope"),
          ...getRecordStringArray(entry, "rawSignals"),
        ];
      }),
    );
  }

  if (isRecord(value)) {
    return dedupe([
      getRecordString(value, "type"),
      getRecordString(value, "scope"),
      ...getRecordStringArray(value, "rawSignals"),
    ]);
  }

  return [];
}

function extractViolationObjectSignals(
  state: ProblemResolutionState,
  path: readonly string[],
): string[] {
  const value = getNestedUnknown(state, path);

  if (!isRecord(value)) {
    return [];
  }

  return dedupe([
    ...getRecordStringArray(value, "reasons"),
    ...getRecordStringArray(value, "rawSignals"),
    getRecordString(value, "reason"),
    getRecordString(value, "message"),
  ]);
}

function extractProofObligationDescriptions(
  state: ProblemResolutionState,
  path: readonly string[],
): string[] {
  const value = getNestedUnknown(state, path);

  if (!Array.isArray(value)) {
    return [];
  }

  return dedupe(
    value.map((entry) => {
      if (!isRecord(entry)) {
        return String(entry ?? "");
      }

      return (
        getRecordString(entry, "description") ||
        getRecordString(entry, "id") ||
        getRecordString(entry, "category")
      );
    }),
  );
}

function extractUnsatisfiedProofObligations(
  state: ProblemResolutionState,
  path: readonly string[],
): string[] {
  const value = getNestedUnknown(state, path);

  if (!Array.isArray(value)) {
    return [];
  }

  return dedupe(
    value
      .filter((entry) => {
        if (!isRecord(entry)) {
          return false;
        }

        return getRecordBoolean(entry, "satisfied") === false;
      })
      .map((entry) => {
        if (!isRecord(entry)) {
          return "";
        }

        return (
          getRecordString(entry, "description") ||
          getRecordString(entry, "id") ||
          getRecordString(entry, "category")
        );
      }),
  );
}

function extractBranchAssignmentFailures(
  state: ProblemResolutionState,
  path: readonly string[],
): string[] {
  const value = getNestedUnknown(state, path);

  if (!Array.isArray(value)) {
    return [];
  }

  return dedupe(
    value.flatMap((entry) => {
      if (!isRecord(entry)) {
        return [];
      }

      const branchId = getRecordString(entry, "branchId");
      const passed = getRecordBoolean(entry, "passed") === true;

      return !passed && branchId ? [branchId] : [];
    }),
  );
}

function extractBranchMissingAssignments(
  state: ProblemResolutionState,
  path: readonly string[],
): string[] {
  const value = getNestedUnknown(state, path);

  if (!Array.isArray(value)) {
    return [];
  }

  return dedupe(
    value.flatMap((entry) => {
      if (!isRecord(entry)) {
        return [];
      }

      const branchId = getRecordString(entry, "branchId");
      const missing = getRecordStringArray(entry, "missingVariables");

      return missing.map((item) => (branchId ? `${branchId}:${item}` : item));
    }),
  );
}

function findConstraintSignals(
  state: ProblemResolutionState,
  markers: readonly string[],
): string[] {
  const searchable = [
    ...getNestedStringArray(state, ["explicitConstraints"]),
    ...getNestedStringArray(state, ["implicitConstraints"]),
    ...getNestedStringArray(state, ["constraints", "explicit"]),
    ...getNestedStringArray(state, ["constraints", "implicit"]),
    ...getNestedStringArray(state, ["representation", "explicitConstraints"]),
    ...getNestedStringArray(state, ["representation", "implicitConstraints"]),
    ...getNestedStringArray(state, ["closure", "violatedConstraints"]),
    ...getNestedStringArray(state, ["completionObligations"]),
    ...getNestedStringArray(state, ["report", "missingObligations"]),
  ];

  return dedupe(
    searchable.filter((entry) =>
      markers.some((marker) =>
        normalizeText(entry).includes(normalizeText(marker)),
      ),
    ),
  );
}

function filterByKeys(values: readonly string[], keys: readonly string[]): string[] {
  return dedupe(
    values.filter((value) => {
      const normalized = normalizeText(value);

      return keys.some((key) => normalized.includes(normalizeText(key)));
    }),
  );
}

function flattenRecordOfStringArrays(value: unknown): string[] {
  if (!isRecord(value)) {
    return [];
  }

  return dedupe(
    Object.entries(value).flatMap(([key, entryValue]) => {
      if (!Array.isArray(entryValue)) {
        return [];
      }

      return entryValue.map((item) => `${key}:${String(item ?? "").trim()}`);
    }),
  );
}

function getNestedStringArray(
  source: unknown,
  path: readonly string[],
): string[] {
  const value = getNestedUnknown(source, path);

  return toStringArray(value);
}

function getNestedBoolean(
  source: unknown,
  path: readonly string[],
  fallback: boolean,
): boolean {
  const value = getNestedUnknown(source, path);

  return typeof value === "boolean" ? value : fallback;
}

function getNestedUnknown(source: unknown, path: readonly string[]): unknown {
  let current: unknown = source;

  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return dedupe(
    value
      .map((entry) => {
        if (typeof entry === "string") {
          return entry;
        }

        if (isRecord(entry)) {
          return (
            getRecordString(entry, "description") ||
            getRecordString(entry, "condition") ||
            getRecordString(entry, "id") ||
            getRecordString(entry, "category") ||
            getRecordString(entry, "message")
          );
        }

        return String(entry ?? "");
      })
      .filter(Boolean),
  );
}

function getRecordString(source: unknown, key: string): string {
  if (!isRecord(source)) {
    return "";
  }

  const value = source[key];

  return typeof value === "string" ? value : "";
}

function getRecordStringArray(source: unknown, key: string): string[] {
  if (!isRecord(source)) {
    return [];
  }

  return toStringArray(source[key]);
}

function getRecordNumber(source: unknown, key: string): number | undefined {
  if (!isRecord(source)) {
    return undefined;
  }

  const value = source[key];

  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getRecordBoolean(source: unknown, key: string): boolean | undefined {
  if (!isRecord(source)) {
    return undefined;
  }

  const value = source[key];

  return typeof value === "boolean" ? value : undefined;
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

function normalizeText(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s_.:-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}