/**
 * Layer: 14-reasoning-and-generation-layer/problem-resolution-core
 * Module: problem-resolution-orchestrator
 * Responsibility: Coordinate the full reasoning completeness pass.
 */

import type {
  AssignmentConsistencyResult,
  ProblemResolutionInput,
  ProblemResolutionState,
  ProofObligation,
  ProofObligationEvaluation,
  ReasoningRisk,
  ScenarioCoverageResult,
} from "./problem-resolution-types";
import { classifyTaskReasoningNeed } from "./task-reasoning-classifier";
import { buildProblemRepresentation } from "./problem-representation-builder";
import { enumerateReasoningScenarios } from "./scenario-enumerator";
import { buildConstraintLedger } from "./constraint-ledger";
import { trackInvariants } from "./invariant-tracker";
import { validateScenarioCoverage } from "./scenario-coverage-validator";
import { checkAssignmentConsistency } from "./assignment-consistency-checker";
import {
  buildProofObligations,
  evaluateProofObligations,
} from "./proof-obligation-builder";
import { runStepCompletionGuard } from "./step-completion-guard";
import { runLogicalClosureChecker } from "./logical-closure-checker";
import { buildAnswerDraftRepairPlan } from "./answer-draft-repair-planner";

interface ResolutionReport {
  missingObligations: string[];
  missingProofObligations: string[];
  unresolvedScenarios: string[];
  violatedConstraints: string[];
  unsupportedConclusions: string[];
}

function normalizeText(value: string): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupe(values: ReadonlyArray<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = normalizeText(String(value ?? ""));
    const key = cleaned.toLowerCase();

    if (!cleaned || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function safeArray<T>(values: readonly T[] | undefined): T[] {
  return Array.isArray(values) ? [...values] : [];
}

function safeStringArray(values: readonly string[] | undefined): string[] {
  return dedupe(Array.isArray(values) ? values : []);
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

function resolveProofObligations(
  representation: ReturnType<typeof buildProblemRepresentation>,
): ProofObligation[] {
  if (
    Array.isArray(representation.proofObligations) &&
    representation.proofObligations.length > 0
  ) {
    return representation.proofObligations;
  }

  return buildProofObligations(representation);
}

function buildConsolidatedReport(input: {
  ledgerMissingObligations: readonly string[];
  proofEvaluation: ProofObligationEvaluation;
  completionUnresolvedScenarios: readonly string[];
  scenarioCoverage: ScenarioCoverageResult;
  ledgerViolatedConstraints: readonly string[];
  assignmentConsistency: AssignmentConsistencyResult;
  completionUnsupportedConclusions: readonly string[];
}): ResolutionReport {
  return {
    missingObligations: dedupe([
      ...input.ledgerMissingObligations,
      ...input.proofEvaluation.missing,
    ]),

    missingProofObligations: dedupe(input.proofEvaluation.missing),

    unresolvedScenarios: dedupe([
      ...input.completionUnresolvedScenarios,
      ...input.scenarioCoverage.missingBranches,
    ]),

    violatedConstraints: dedupe([
      ...input.ledgerViolatedConstraints,
      ...safeStringArray(input.assignmentConsistency.violatedAssignmentRules).map(
        (rule) => `assignment_rule:${rule}`,
      ),
    ]),

    unsupportedConclusions: dedupe([
      ...input.completionUnsupportedConclusions,
      ...(input.assignmentConsistency.passed === false
        ? ["assignment_consistency_failed"]
        : []),
      ...(input.proofEvaluation.missing.length > 0
        ? ["proof_obligations_not_fully_satisfied"]
        : []),
    ]),
  };
}

export function runProblemResolutionOrchestrator(
  input: ProblemResolutionInput,
): ProblemResolutionState {
  const normalizedInput: ProblemResolutionInput = {
    ...input,
    userInput: normalizeText(input.userInput || ""),
    draftAnswer: normalizeText(input.draftAnswer || ""),
  };

  const reasoningNeed = classifyTaskReasoningNeed(normalizedInput);
  const representation = buildProblemRepresentation(normalizedInput, reasoningNeed);
  const scenarios = enumerateReasoningScenarios(representation);
  const draftAnswer = normalizedInput.draftAnswer || "";

  const ledger = buildConstraintLedger(representation, draftAnswer);
  const invariantState = trackInvariants(
    representation,
    normalizedInput.userInput,
    draftAnswer,
  );

  const scenarioCoverage = validateScenarioCoverage({
    scenarioBranches: representation.scenarioBranches,
    draftAnswer,
  });

  const assignmentConsistency = checkAssignmentConsistency({
    domainMapping: representation.domainMapping,
    draftAnswer,
    explicitConstraints: representation.explicitConstraints,
    scenarioBranches: representation.scenarioBranches,
  });

  const proofObligations = resolveProofObligations(representation);

  const proofEvaluation = evaluateProofObligations(
    proofObligations,
    draftAnswer,
    {
      violatedConstraints: ledger.violatedConstraints,
      scenarioCoverage,
      assignmentConsistency,
      actionBudgetViolated: ledger.actionBudgetViolation,
      observationLimitViolated: ledger.observationLimitViolation,
      unsupportedConclusions: [],
    },
  );

  const unresolvedVariables = dedupe([
    ...ledger.unresolvedVariables,
    ...assignmentConsistency.missingAssignments,
  ]);

  const completionState = runStepCompletionGuard({
    representation,
    scenarios,
    draftAnswer,
    unresolvedVariables,
  });

  const closureState = runLogicalClosureChecker({
    ledger,
    invariants: invariantState,
    completion: completionState,
    scenarioCoverage,
    assignmentConsistency,
    proofEvaluation,
  });

  const report = buildConsolidatedReport({
    ledgerMissingObligations: ledger.missingObligations,
    proofEvaluation,
    completionUnresolvedScenarios: completionState.unresolvedScenarios,
    scenarioCoverage,
    ledgerViolatedConstraints: ledger.violatedConstraints,
    assignmentConsistency,
    completionUnsupportedConclusions: completionState.unsupportedConclusions,
  });

  const risks = dedupeRisks([
    ...closureState.risks,
    ...ledger.risks,
    ...invariantState.risks,
    ...completionState.risks,
    ...safeArray(proofEvaluation.risks),
  ]);

  const repairPlan = buildAnswerDraftRepairPlan({
    reasoningNeed,
    userGoal: representation.userGoal,
    taskType: representation.taskType,
    logicalProblemKind: representation.logicalProblemKind,

    entities: representation.entities,
    variables: representation.variables,

    explicitConstraints: representation.explicitConstraints,
    implicitConstraints: representation.implicitConstraints,
    invariants: invariantState.invariants,

    scenarios,
    scenarioBranches: representation.scenarioBranches,

    completionObligations: representation.completionObligations,
    closureRequirements: representation.closureRequirements,

    unresolvedVariables: closureState.closure.missingVariables,
    assumptions: representation.assumptions,

    risks,
    closure: closureState.closure,

    repairInstructions: [],

    representation,
    constraintLedger: ledger.ledger,

    actionBudget: representation.actionBudget,
    observationLimits: representation.observationLimits,
    domainMapping: representation.domainMapping,

    proofObligations,
    scenarioCoverage,
    assignmentConsistency,
    proofEvaluation,

    report,
  });

  return {
    reasoningNeed,
    userGoal: representation.userGoal,
    taskType: representation.taskType,
    logicalProblemKind: representation.logicalProblemKind,

    entities: representation.entities,
    variables: representation.variables,

    explicitConstraints: representation.explicitConstraints,
    implicitConstraints: representation.implicitConstraints,
    invariants: invariantState.invariants,

    scenarios,
    scenarioBranches: representation.scenarioBranches,

    completionObligations: representation.completionObligations,
    closureRequirements: representation.closureRequirements,

    unresolvedVariables: closureState.closure.missingVariables,
    assumptions: representation.assumptions,

    actionBudget: representation.actionBudget,
    observationLimits: representation.observationLimits,
    domainMapping: representation.domainMapping,

    proofObligations,
    scenarioCoverage,
    assignmentConsistency,
    proofEvaluation,

    risks,
    closure: closureState.closure,
    repairInstructions: repairPlan.repairInstructions,

    representation: {
      ...representation,
      proofObligations,
      scenarioCoverage,
      assignmentConsistency,
    },

    constraintLedger: ledger.ledger,
    report,
  };
}