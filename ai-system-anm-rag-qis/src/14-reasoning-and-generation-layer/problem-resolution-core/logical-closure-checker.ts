/**
 * Layer: 14-reasoning-and-generation-layer/problem-resolution-core
 * Module: logical-closure-checker
 * Responsibility: Produce closure assessment from tracked reasoning signals.
 */

import type {
  AssignmentConsistencyResult,
  LogicalClosureAssessment,
  ProofObligationEvaluation,
  ReasoningRisk,
  ScenarioCoverageResult,
} from "./problem-resolution-types";
import type { ConstraintLedgerResult } from "./constraint-ledger";
import type { InvariantTrackerResult } from "./invariant-tracker";
import type { StepCompletionGuardResult } from "./step-completion-guard";

interface LogicalClosureInput {
  ledger: ConstraintLedgerResult;
  invariants: InvariantTrackerResult;
  completion: StepCompletionGuardResult;
  scenarioCoverage?: ScenarioCoverageResult;
  assignmentConsistency?: AssignmentConsistencyResult;
  proofEvaluation?: ProofObligationEvaluation;
}

interface ClosureSignalSet {
  missingVariables: string[];
  violatedConstraints: string[];
  unresolvedScenarios: string[];
  unsupportedConclusions: string[];
  contradictions: string[];
  missingProofObligations: string[];
}

interface ClosureSeveritySummary {
  hardViolationCount: number;
  structuralViolationCount: number;
  inferentialViolationCount: number;
  formalFailureCount: number;
  penalty: number;
  completionScore: number;
}

interface AssignmentDiagnostics {
  branchFailures: string[];
  branchMissingVariables: string[];
  unresolvedByBranch: string[];
  extractedAssignmentCount: number;
}

interface ScenarioDiagnostics {
  partiallyCoveredBranches: string[];
  unresolvedBranches: string[];
  failedBranchReasons: string[];
}

const HARD_CONSTRAINT_INVARIANTS = [
  "preserve_action_budget",
  "preserve_observation_limit",
  "preserve_explicit_constraints",
  "preserve_constraints_until_closure",
  "preserve_exclusivity",
  "preserve_assignment_rules",
];

const SCENARIO_INVARIANTS = [
  "cover_required_scenarios",
  "cover_all_scenario_branches",
];

const ASSIGNMENT_INVARIANTS = [
  "resolve_all_variables",
  "assign_all_variables",
  "validate_final_mapping",
  "preserve_assignment_rules",
  "preserve_exclusivity",
];

const UNSUPPORTED_CONCLUSION_INVARIANTS = [
  "avoid_contradictory_answer_state",
  "conclusion_must_follow_from_constraints",
  "support_final_conclusion",
  "avoid_unjustified_assumptions",
];

const PROMISE_WITHOUT_EXECUTION_SIGNALS = [
  "determination_promised_but_not_executed",
  "assignment_promised_but_not_executed",
  "elimination_mentioned_but_not_executed",
  "elimination_claim_without_executed_elimination",
  "scenario_promised_but_not_executed",
  "branch_promised_but_not_resolved",
];

const SCENARIO_NOT_CLOSED_SIGNALS = [
  "scenario_mentioned_but_not_resolved",
  "case_analysis_started_but_not_closed",
  "conclusion_before_scenario_closure",
  "scenario_branch_not_fully_assigned",
  "branch_assignments_not_fully_resolved",
  "branch_variables_missing_assignment",
];

const ASSIGNMENT_NOT_CLOSED_SIGNALS = [
  "assignment_consistency_not_satisfied",
  "assignment_variables_not_fully_resolved",
  "claimed_full_determination_without_full_assignment",
  "generic_conclusion_without_mapping_structure",
  "complete_assignment_required",
  "scenario_assignments_incomplete",
  "branch_assignment_incomplete",
];

export function runLogicalClosureChecker(input: LogicalClosureInput): {
  closure: LogicalClosureAssessment;
  risks: ReasoningRisk[];
} {
  const signals = buildClosureSignals(input);
  const severity = summarizeClosureSeverity(input, signals);

  const passed =
    severity.hardViolationCount === 0 &&
    severity.structuralViolationCount === 0 &&
    severity.inferentialViolationCount === 0 &&
    severity.formalFailureCount === 0 &&
    !input.completion.prematureClosureDetected &&
    severity.completionScore >= 0.75;

  const risks = dedupeRisks([
    ...safeRisks(input.ledger.risks),
    ...safeRisks(input.invariants.risks),
    ...safeRisks(input.completion.risks),
    ...safeRisks(input.proofEvaluation?.risks),
    ...buildDerivedRisks(input, signals, severity),
  ]);

  return {
    closure: {
      passed,
      missingVariables: signals.missingVariables,
      violatedConstraints: signals.violatedConstraints,
      unresolvedScenarios: signals.unresolvedScenarios,
      unsupportedConclusions: signals.unsupportedConclusions,
      contradictions: signals.contradictions,
      completionScore: severity.completionScore,
      missingProofObligations: signals.missingProofObligations,
    },
    risks,
  };
}

function buildClosureSignals(input: LogicalClosureInput): ClosureSignalSet {
  const ledgerDiagnostics = readLedgerDiagnostics(input.ledger);
  const assignmentDiagnostics = readAssignmentDiagnostics(
    input.assignmentConsistency,
  );
  const scenarioDiagnostics = readScenarioDiagnostics(input.scenarioCoverage);

  const missingVariables = dedupe([
    ...safeArray(input.ledger.unresolvedVariables),
    ...safeArray(input.assignmentConsistency?.missingAssignments),
    ...assignmentDiagnostics.branchMissingVariables,
    ...assignmentDiagnostics.unresolvedByBranch,
    ...(invariantPresent(input.invariants, "preserve_core_goal")
      ? ["core_goal_alignment"]
      : []),
    ...(invariantPresentAny(input.invariants, ASSIGNMENT_INVARIANTS)
      ? safeArray(input.assignmentConsistency?.missingAssignments)
      : []),
  ]);

  const violatedConstraints = dedupe([
    ...safeArray(input.ledger.violatedConstraints),
    ...(ledgerDiagnostics.actionBudgetViolation
      ? ["formal_operation_budget_violation"]
      : []),
    ...(ledgerDiagnostics.observationLimitViolation
      ? ["formal_observation_limit_violation"]
      : []),
    ...ledgerDiagnostics.assignmentRuleViolations.map(
      (rule) => `assignment_rule:${rule}`,
    ),
    ...safeArray(input.assignmentConsistency?.violatedAssignmentRules).map(
      (rule) => `assignment_rule:${rule}`,
    ),
    ...(invariantPresentAny(input.invariants, HARD_CONSTRAINT_INVARIANTS)
      ? filterInvariantViolations(input.invariants, HARD_CONSTRAINT_INVARIANTS)
      : []),
  ]);

  const unresolvedScenarios = dedupe([
    ...safeArray(input.completion.unresolvedScenarios),
    ...safeArray(input.scenarioCoverage?.missingBranches),
    ...scenarioDiagnostics.partiallyCoveredBranches.map(
      (branch) => `partially_covered:${branch}`,
    ),
    ...scenarioDiagnostics.unresolvedBranches,
    ...assignmentDiagnostics.branchFailures.map(
      (branch) => `assignment_incomplete:${branch}`,
    ),
    ...(invariantPresentAny(input.invariants, SCENARIO_INVARIANTS)
      ? filterInvariantViolations(input.invariants, SCENARIO_INVARIANTS)
      : []),
  ]);

  const unsupportedConclusions = dedupe([
    ...safeArray(input.completion.unsupportedConclusions),
    ...(input.assignmentConsistency?.passed === false
      ? ["assignment_consistency_failed"]
      : []),
    ...(input.scenarioCoverage?.passed === false
      ? ["scenario_coverage_failed"]
      : []),
    ...(safeArray(input.proofEvaluation?.missing).length > 0
      ? ["proof_obligations_not_fully_satisfied"]
      : []),
    ...scenarioDiagnostics.failedBranchReasons.map(
      (reason) => `scenario_failure:${reason}`,
    ),
    ...(invariantPresentAny(input.invariants, UNSUPPORTED_CONCLUSION_INVARIANTS)
      ? filterInvariantViolations(
          input.invariants,
          UNSUPPORTED_CONCLUSION_INVARIANTS,
        )
      : []),
  ]);

  const contradictions = dedupe([
    ...safeArray(input.completion.contradictions),
    ...(invariantPresent(input.invariants, "avoid_contradictory_answer_state")
      ? ["contradictory_answer_state"]
      : []),
  ]);

  const missingProofObligations = dedupe([
    ...safeArray(input.proofEvaluation?.missing),
  ]);

  return {
    missingVariables,
    violatedConstraints,
    unresolvedScenarios,
    unsupportedConclusions,
    contradictions,
    missingProofObligations,
  };
}

function summarizeClosureSeverity(
  input: LogicalClosureInput,
  signals: ClosureSignalSet,
): ClosureSeveritySummary {
  const ledgerDiagnostics = readLedgerDiagnostics(input.ledger);
  const assignmentDiagnostics = readAssignmentDiagnostics(
    input.assignmentConsistency,
  );
  const scenarioDiagnostics = readScenarioDiagnostics(input.scenarioCoverage);

  const hardViolationCount =
    signals.violatedConstraints.length +
    signals.contradictions.length +
    (ledgerDiagnostics.actionBudgetViolation ? 1 : 0) +
    (ledgerDiagnostics.observationLimitViolation ? 1 : 0) +
    (input.scenarioCoverage?.passed === false ? 1 : 0) +
    (input.assignmentConsistency?.passed === false ? 1 : 0);

  const structuralViolationCount =
    signals.missingVariables.length +
    signals.unresolvedScenarios.length +
    signals.missingProofObligations.length +
    assignmentDiagnostics.branchFailures.length +
    scenarioDiagnostics.partiallyCoveredBranches.length;

  const inferentialViolationCount =
    signals.unsupportedConclusions.length +
    (input.completion.prematureClosureDetected ? 1 : 0);

  const formalFailureCount =
    (input.scenarioCoverage?.passed === false ? 1 : 0) +
    (input.assignmentConsistency?.passed === false ? 1 : 0) +
    (safeArray(input.proofEvaluation?.missing).length > 0 ? 1 : 0) +
    (ledgerDiagnostics.actionBudgetViolation ? 1 : 0) +
    (ledgerDiagnostics.observationLimitViolation ? 1 : 0);

  const promiseWithoutExecutionCount = countSignalMatches(
    signals.unsupportedConclusions,
    PROMISE_WITHOUT_EXECUTION_SIGNALS,
  );

  const scenarioClosureFailureCount = countSignalMatches(
    signals.unsupportedConclusions,
    SCENARIO_NOT_CLOSED_SIGNALS,
  );

  const assignmentClosureFailureCount = countSignalMatches(
    signals.unsupportedConclusions,
    ASSIGNMENT_NOT_CLOSED_SIGNALS,
  );

  const penalty =
    signals.missingVariables.length * 0.16 +
    signals.violatedConstraints.length * 0.22 +
    signals.unresolvedScenarios.length * 0.18 +
    signals.unsupportedConclusions.length * 0.2 +
    signals.contradictions.length * 0.24 +
    signals.missingProofObligations.length * 0.16 +
    safeArray(input.invariants.violatedInvariants).length * 0.08 +
    (ledgerDiagnostics.actionBudgetViolation ? 0.3 : 0) +
    (ledgerDiagnostics.observationLimitViolation ? 0.3 : 0) +
    (input.scenarioCoverage?.passed === false ? 0.3 : 0) +
    (input.assignmentConsistency?.passed === false ? 0.3 : 0) +
    (input.completion.prematureClosureDetected ? 0.26 : 0) +
    promiseWithoutExecutionCount * 0.24 +
    scenarioClosureFailureCount * 0.22 +
    assignmentClosureFailureCount * 0.22 +
    assignmentDiagnostics.branchFailures.length * 0.18 +
    scenarioDiagnostics.partiallyCoveredBranches.length * 0.16;

  const completionScore = Number(clamp01(1 - penalty).toFixed(4));

  return {
    hardViolationCount,
    structuralViolationCount,
    inferentialViolationCount,
    formalFailureCount,
    penalty,
    completionScore,
  };
}

function buildDerivedRisks(
  input: LogicalClosureInput,
  signals: ClosureSignalSet,
  severity: ClosureSeveritySummary,
): ReasoningRisk[] {
  const risks: ReasoningRisk[] = [];
  const ledgerDiagnostics = readLedgerDiagnostics(input.ledger);
  const assignmentDiagnostics = readAssignmentDiagnostics(
    input.assignmentConsistency,
  );
  const scenarioDiagnostics = readScenarioDiagnostics(input.scenarioCoverage);

  if (ledgerDiagnostics.actionBudgetViolation) {
    risks.push({
      type: "abandoned_constraint",
      severity: "high",
      message:
        "Operation-budget violation detected. The draft appears to expand a limited operation beyond the allowed budget.",
    });
  }

  if (ledgerDiagnostics.observationLimitViolation) {
    risks.push({
      type: "abandoned_constraint",
      severity: "high",
      message:
        "Observation-limit violation detected. The draft appears to depend on disallowed observation, checking or hidden information.",
    });
  }

  if (input.scenarioCoverage?.passed === false) {
    risks.push({
      type: "incomplete_case_analysis",
      severity: "high",
      message:
        `Scenario coverage failed. Missing/unresolved branches: ` +
        `${dedupe([
          ...safeArray(input.scenarioCoverage.missingBranches),
          ...scenarioDiagnostics.partiallyCoveredBranches,
          ...scenarioDiagnostics.unresolvedBranches,
        ]).join(" | ") || "none"}.`,
    });
  }

  if (scenarioDiagnostics.partiallyCoveredBranches.length > 0) {
    risks.push({
      type: "incomplete_case_analysis",
      severity: "high",
      message:
        `Scenario branches were mentioned but not logically resolved: ` +
        `${scenarioDiagnostics.partiallyCoveredBranches.join(" | ")}.`,
    });
  }

  if (input.assignmentConsistency?.passed === false) {
    const missing = safeArray(input.assignmentConsistency.missingAssignments);
    const duplicate = safeArray(input.assignmentConsistency.duplicateAssignments);
    const violatedRules = safeArray(
      input.assignmentConsistency.violatedAssignmentRules,
    );

    risks.push({
      type: missing.length > 0 ? "unresolved_variable" : "unsupported_conclusion",
      severity: "high",
      message:
        `Assignment consistency failed. ` +
        `Missing: ${missing.join(", ") || "none"}. ` +
        `Duplicate: ${duplicate.join(", ") || "none"}. ` +
        `Violated rules: ${violatedRules.join(" | ") || "none"}.`,
    });
  }

  if (assignmentDiagnostics.branchFailures.length > 0) {
    risks.push({
      type: "incomplete_case_analysis",
      severity: "high",
      message:
        `Branch-level assignment closure failed: ` +
        `${assignmentDiagnostics.branchFailures.join(" | ")}.`,
    });
  }

  if (signals.missingProofObligations.length > 0) {
    risks.push({
      type: "unsupported_conclusion",
      severity: signals.missingProofObligations.length > 1 ? "high" : "medium",
      message: `Missing proof obligations: ${signals.missingProofObligations.join(
        " | ",
      )}`,
    });
  }

  if (signals.unsupportedConclusions.length > 0) {
    risks.push({
      type: "unsupported_conclusion",
      severity: signals.unsupportedConclusions.length > 1 ? "high" : "medium",
      message: `Unsupported conclusions: ${signals.unsupportedConclusions.join(
        " | ",
      )}`,
    });
  }

  if (
    countSignalMatches(
      signals.unsupportedConclusions,
      PROMISE_WITHOUT_EXECUTION_SIGNALS,
    ) > 0
  ) {
    risks.push({
      type: "unsupported_conclusion",
      severity: "high",
      message:
        "The draft promises determination, elimination or final resolution without executing the required reasoning closure.",
    });
  }

  if (signals.unresolvedScenarios.length > 0) {
    risks.push({
      type: "incomplete_case_analysis",
      severity: signals.unresolvedScenarios.length > 1 ? "high" : "medium",
      message: `Unresolved scenarios: ${signals.unresolvedScenarios.join(
        " | ",
      )}`,
    });
  }

  if (signals.missingVariables.length > 0) {
    risks.push({
      type: "unresolved_variable",
      severity: signals.missingVariables.length > 2 ? "high" : "medium",
      message: `Missing variables: ${signals.missingVariables.join(", ")}`,
    });
  }

  if (signals.violatedConstraints.length > 0) {
    risks.push({
      type: "abandoned_constraint",
      severity: signals.violatedConstraints.length > 1 ? "high" : "medium",
      message: `Violated constraints: ${signals.violatedConstraints.join(
        " | ",
      )}`,
    });
  }

  if (signals.contradictions.length > 0) {
    risks.push({
      type: "unsupported_conclusion",
      severity: signals.contradictions.length > 1 ? "high" : "medium",
      message: `Contradictory closure signals: ${signals.contradictions.join(
        " | ",
      )}`,
    });
  }

  if (input.completion.prematureClosureDetected) {
    risks.push({
      type: "premature_closure",
      severity: "high",
      message:
        "Premature closure detected. The answer attempts to conclude before satisfying reasoning, scenario, assignment or proof obligations.",
    });
  }

  if (severity.completionScore < 0.75) {
    risks.push({
      type: "unsupported_conclusion",
      severity: severity.completionScore < 0.45 ? "high" : "medium",
      message: `Logical closure score below threshold: ${severity.completionScore.toFixed(
        2,
      )}.`,
    });
  }

  return risks;
}

function readLedgerDiagnostics(ledger: ConstraintLedgerResult): {
  actionBudgetViolation: boolean;
  observationLimitViolation: boolean;
  assignmentRuleViolations: string[];
} {
  const record = asRecord(ledger);

  return {
    actionBudgetViolation: readBoolean(record, "actionBudgetViolation"),
    observationLimitViolation: readBoolean(record, "observationLimitViolation"),
    assignmentRuleViolations: readStringArray(record, "assignmentRuleViolations"),
  };
}

function readScenarioDiagnostics(
  scenarioCoverage: ScenarioCoverageResult | undefined,
): ScenarioDiagnostics {
  const record = asRecord(scenarioCoverage);

  return {
    partiallyCoveredBranches: readStringArray(
      record,
      "partiallyCoveredBranches",
    ),
    unresolvedBranches: readStringArray(record, "unresolvedBranches"),
    failedBranchReasons: Object.values(
      readRecordOfStringArrays(record, "branchFailures"),
    ).flat(),
  };
}

function readAssignmentDiagnostics(
  assignmentConsistency: AssignmentConsistencyResult | undefined,
): AssignmentDiagnostics {
  const record = asRecord(assignmentConsistency);
  const branchCoverage = record.branchAssignmentCoverage;
  const branchFailures: string[] = [];
  const branchMissingVariables: string[] = [];

  if (Array.isArray(branchCoverage)) {
    for (const entry of branchCoverage) {
      const item = asRecord(entry);
      const branchId = readString(item, "branchId");
      const passed = item.passed === true;
      const missingVariables = readStringArray(item, "missingVariables");

      if (!passed && branchId) {
        branchFailures.push(branchId);
      }

      branchMissingVariables.push(
        ...missingVariables.map((variable) =>
          branchId ? `${branchId}:${variable}` : variable,
        ),
      );
    }
  }

  const unassignedByBranch = readRecordOfStringArrays(
    record,
    "unassignedByBranch",
  );

  const extractedAssignments = readRecordOfStrings(
    record,
    "extractedAssignments",
  );

  return {
    branchFailures: dedupe(branchFailures),
    branchMissingVariables: dedupe(branchMissingVariables),
    unresolvedByBranch: dedupe(
      Object.entries(unassignedByBranch).flatMap(([branch, variables]) =>
        variables.map((variable) => `${branch}:${variable}`),
      ),
    ),
    extractedAssignmentCount: Object.keys(extractedAssignments).length,
  };
}

function filterInvariantViolations(
  invariants: InvariantTrackerResult,
  accepted: readonly string[],
): string[] {
  return safeArray(invariants.violatedInvariants).filter((invariant) =>
    accepted.includes(invariant),
  );
}

function invariantPresent(
  invariants: InvariantTrackerResult,
  invariant: string,
): boolean {
  return safeArray(invariants.violatedInvariants).includes(invariant);
}

function invariantPresentAny(
  invariants: InvariantTrackerResult,
  candidates: readonly string[],
): boolean {
  return candidates.some((candidate) => invariantPresent(invariants, candidate));
}

function countSignalMatches(
  signals: readonly string[],
  patterns: readonly string[],
): number {
  const normalizedPatterns = patterns.map(normalize);

  return signals.filter((signal) => {
    const normalizedSignal = normalize(signal);

    return normalizedPatterns.some(
      (pattern) =>
        normalizedSignal.includes(pattern) || pattern.includes(normalizedSignal),
    );
  }).length;
}

function safeArray(values: readonly string[] | undefined): string[] {
  return Array.isArray(values)
    ? values.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];
}

function safeRisks(values: readonly ReasoningRisk[] | undefined): ReasoningRisk[] {
  return Array.isArray(values) ? [...values] : [];
}

function readBoolean(source: Record<string, unknown>, key: string): boolean {
  return source[key] === true;
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];

  return typeof value === "string" ? value : "";
}

function readStringArray(source: Record<string, unknown>, key: string): string[] {
  const value = source[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return dedupe(
    value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean),
  );
}

function readRecordOfStringArrays(
  source: Record<string, unknown>,
  key: string,
): Record<string, string[]> {
  const value = source[key];

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, string[]> = {};

  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (!Array.isArray(entryValue)) {
      continue;
    }

    const normalizedKey = String(entryKey ?? "").trim();

    if (!normalizedKey) {
      continue;
    }

    result[normalizedKey] = dedupe(
      entryValue
        .map((item) => String(item ?? "").trim())
        .filter(Boolean),
    );
  }

  return result;
}

function readRecordOfStrings(
  source: Record<string, unknown>,
  key: string,
): Record<string, string> {
  const value = source[key];

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, string> = {};

  for (const [entryKey, entryValue] of Object.entries(value)) {
    const normalizedKey = String(entryKey ?? "").trim();
    const normalizedValue = String(entryValue ?? "").trim();

    if (!normalizedKey || !normalizedValue) {
      continue;
    }

    result[normalizedKey] = normalizedValue;
  }

  return result;
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
    const key = `${risk.type}:${normalize(risk.message)}`;
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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalize(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}