/**
 * Layer: 14b-critical-council-layer
 * Module: problem-resolution-signal-reader
 * Responsibility: Normalize problem-resolution signals from layer 14 for council decisions.
 */

import type { CouncilAction, CouncilInput } from "./council-types";

export type ProblemResolutionRepairMode =
  | "none"
  | "light_repair"
  | "substantial_revision"
  | "regenerate";

export interface ProblemResolutionCouncilSignals {
  readonly hasProblemResolutionState: boolean;
  readonly hasProblemResolutionArtifact: boolean;

  readonly closurePassed: boolean | null;
  readonly completionScore: number | null;

  readonly missingVariables: string[];
  readonly missingObligations: string[];
  readonly missingProofObligations: string[];
  readonly unresolvedScenarios: string[];
  readonly violatedConstraints: string[];
  readonly unsupportedConclusions: string[];
  readonly contradictions: string[];

  readonly scenarioCoveragePassed: boolean | null;
  readonly scenarioCoverageMissingBranches: string[];
  readonly scenarioCoverageCoveredBranches: string[];

  readonly assignmentConsistencyPassed: boolean | null;
  readonly assignmentMissingAssignments: string[];
  readonly assignmentDuplicateAssignments: string[];
  readonly assignmentViolatedRules: string[];

  readonly proofEvaluationMissing: string[];
  readonly proofEvaluationSatisfied: string[];

  readonly riskTypes: string[];
  readonly repairMode: ProblemResolutionRepairMode | null;
  readonly repairApplied: boolean | null;

  readonly hardFailureReasons: string[];
  readonly requiredActionFloor: CouncilAction | null;
}

export function extractProblemResolutionCouncilSignals(
  input: CouncilInput,
): ProblemResolutionCouncilSignals {
  const state = input.problemResolutionState ?? input.reasoningState ?? null;
  const artifact = input.problemResolutionArtifact ?? null;

  const closurePassed =
    getNestedBoolean(state, ["closure", "passed"]) ??
    getNestedBoolean(artifact, ["closurePassed"]);

  const completionScore =
    getNestedNumber(state, ["closure", "completionScore"]) ??
    getNestedNumber(artifact, ["completionScore"]);

  const scenarioCoveragePassed = getNestedBoolean(state, [
    "scenarioCoverage",
    "passed",
  ]);

  const assignmentConsistencyPassed = getNestedBoolean(state, [
    "assignmentConsistency",
    "passed",
  ]);

  const repairMode = normalizeRepairMode(
    getNestedString(state, ["repairMode"]) ||
      getNestedString(state, ["repairPlan", "repairMode"]) ||
      getNestedString(artifact, ["repairMode"]),
  );

  const repairApplied =
    getNestedBoolean(state, ["repairApplied"]) ??
    getNestedBoolean(artifact, ["repairApplied"]);

  const missingProofObligations = dedupe([
    ...getNestedStringArray(state, ["closure", "missingProofObligations"]),
    ...getNestedStringArray(state, ["report", "missingProofObligations"]),
    ...getNestedStringArray(state, ["proofEvaluation", "missing"]),
    ...getNestedStringArray(artifact, ["missingProofObligations"]),
  ]);

  const proofEvaluationMissing = dedupe([
    ...getNestedStringArray(state, ["proofEvaluation", "missing"]),
    ...missingProofObligations,
  ]);

  const scenarioCoverageMissingBranches = dedupe([
    ...getNestedStringArray(state, ["scenarioCoverage", "missingBranches"]),
    ...getNestedStringArray(state, ["scenarioCoverage", "unresolvedBranches"]),
    ...getNestedStringArray(state, [
      "scenarioCoverage",
      "partiallyCoveredBranches",
    ]),
  ]);

  const assignmentMissingAssignments = dedupe([
    ...getNestedStringArray(state, [
      "assignmentConsistency",
      "missingAssignments",
    ]),
    ...flattenBranchMissingAssignments(
      getNestedValue(state, ["assignmentConsistency", "branchAssignmentCoverage"]),
    ),
  ]);

  const missingVariables = dedupe([
    ...getNestedStringArray(state, ["closure", "missingVariables"]),
    ...getNestedStringArray(state, ["report", "missingVariables"]),
    ...getNestedStringArray(state, ["missingVariables"]),
    ...getNestedStringArray(state, ["unresolvedVariables"]),
    ...assignmentMissingAssignments,
    ...getNestedStringArray(artifact, ["missingVariables"]),
  ]);

  const unresolvedScenarios = dedupe([
    ...getNestedStringArray(state, ["closure", "unresolvedScenarios"]),
    ...getNestedStringArray(state, ["report", "unresolvedScenarios"]),
    ...getNestedStringArray(state, ["unresolvedScenarios"]),
    ...scenarioCoverageMissingBranches,
    ...getNestedStringArray(artifact, ["unresolvedScenarios"]),
  ]);

  const violatedConstraints = dedupe([
    ...getNestedStringArray(state, ["closure", "violatedConstraints"]),
    ...getNestedStringArray(state, ["report", "violatedConstraints"]),
    ...getNestedStringArray(state, ["violatedConstraints"]),
    ...getNestedStringArray(state, [
      "assignmentConsistency",
      "violatedAssignmentRules",
    ]).map((rule) => `assignment_rule:${rule}`),
    ...getNestedStringArray(artifact, ["violatedConstraints"]),
  ]);

  const unsupportedConclusions = dedupe([
    ...getNestedStringArray(state, ["closure", "unsupportedConclusions"]),
    ...getNestedStringArray(state, ["report", "unsupportedConclusions"]),
    ...getNestedStringArray(state, ["unsupportedConclusions"]),
    ...(proofEvaluationMissing.length > 0
      ? ["proof_obligations_not_fully_satisfied"]
      : []),
    ...(scenarioCoveragePassed === false ? ["scenario_coverage_failed"] : []),
    ...(assignmentConsistencyPassed === false
      ? ["assignment_consistency_failed"]
      : []),
    ...getNestedStringArray(artifact, ["unsupportedConclusions"]),
  ]);

  const contradictions = dedupe([
    ...getNestedStringArray(state, ["closure", "contradictions"]),
    ...getNestedStringArray(state, ["contradictions"]),
    ...getNestedStringArray(artifact, ["contradictions"]),
  ]);

  const missingObligations = dedupe([
    ...getNestedStringArray(state, ["report", "missingObligations"]),
    ...getNestedStringArray(state, ["closure", "missingObligations"]),
    ...getNestedStringArray(state, ["missingObligations"]),
    ...missingProofObligations.map(
      (obligation) => `proof_obligation:${obligation}`,
    ),
  ]);

  const riskTypes = dedupe([
    ...getNestedRecordArrayStrings(state, ["risks"], "type"),
    ...getNestedStringArray(artifact, ["riskTypes"]),
  ]);

  const signalsWithoutFailures = {
    hasProblemResolutionState: isRecord(state),
    hasProblemResolutionArtifact: isRecord(artifact),
    closurePassed,
    completionScore,
    missingVariables,
    missingObligations,
    missingProofObligations,
    unresolvedScenarios,
    violatedConstraints,
    unsupportedConclusions,
    contradictions,
    scenarioCoveragePassed,
    scenarioCoverageMissingBranches,
    scenarioCoverageCoveredBranches: getNestedStringArray(state, [
      "scenarioCoverage",
      "coveredBranches",
    ]),
    assignmentConsistencyPassed,
    assignmentMissingAssignments,
    assignmentDuplicateAssignments: getNestedStringArray(state, [
      "assignmentConsistency",
      "duplicateAssignments",
    ]),
    assignmentViolatedRules: getNestedStringArray(state, [
      "assignmentConsistency",
      "violatedAssignmentRules",
    ]),
    proofEvaluationMissing,
    proofEvaluationSatisfied: getNestedStringArray(state, [
      "proofEvaluation",
      "satisfied",
    ]),
    riskTypes,
    repairMode,
    repairApplied,
  };

  const hardFailureReasons = buildHardFailureReasons(signalsWithoutFailures);
  const requiredActionFloor = deriveRequiredActionFloor({
    ...signalsWithoutFailures,
    hardFailureReasons,
  });

  return {
    ...signalsWithoutFailures,
    hardFailureReasons,
    requiredActionFloor,
  };
}

function buildHardFailureReasons(input: {
  readonly closurePassed: boolean | null;
  readonly missingVariables: readonly string[];
  readonly missingObligations: readonly string[];
  readonly missingProofObligations: readonly string[];
  readonly unresolvedScenarios: readonly string[];
  readonly violatedConstraints: readonly string[];
  readonly unsupportedConclusions: readonly string[];
  readonly contradictions: readonly string[];
  readonly scenarioCoveragePassed: boolean | null;
  readonly assignmentConsistencyPassed: boolean | null;
  readonly proofEvaluationMissing: readonly string[];
  readonly riskTypes: readonly string[];
  readonly repairMode: ProblemResolutionRepairMode | null;
}): string[] {
  return dedupe([
    ...(input.closurePassed === false
      ? ["problem_resolution_closure_failed"]
      : []),
    ...input.violatedConstraints.map(
      (value) => `problem_resolution_violated_constraint:${value}`,
    ),
    ...input.contradictions.map(
      (value) => `problem_resolution_contradiction:${value}`,
    ),
    ...input.missingVariables.map(
      (value) => `problem_resolution_missing_variable:${value}`,
    ),
    ...input.unresolvedScenarios.map(
      (value) => `problem_resolution_unresolved_scenario:${value}`,
    ),
    ...input.unsupportedConclusions.map(
      (value) => `problem_resolution_unsupported_conclusion:${value}`,
    ),
    ...input.missingObligations.map(
      (value) => `problem_resolution_missing_obligation:${value}`,
    ),
    ...input.missingProofObligations.map(
      (value) => `problem_resolution_missing_proof_obligation:${value}`,
    ),
    ...(input.scenarioCoveragePassed === false
      ? ["problem_resolution_scenario_coverage_failed"]
      : []),
    ...(input.assignmentConsistencyPassed === false
      ? ["problem_resolution_assignment_consistency_failed"]
      : []),
    ...input.proofEvaluationMissing.map(
      (value) => `problem_resolution_proof_evaluation_missing:${value}`,
    ),
    ...input.riskTypes
      .filter((riskType) =>
        [
          "forbidden_action",
          "observation_limit_violation",
          "assignment_inconsistency",
          "proof_obligation_missing",
          "incomplete_case_analysis",
          "unsupported_conclusion",
          "premature_closure",
        ].includes(normalizeText(riskType)),
      )
      .map((riskType) => `problem_resolution_risk:${riskType}`),
    ...(input.repairMode === "regenerate"
      ? ["problem_resolution_repair_mode_regenerate"]
      : []),
    ...(input.repairMode === "substantial_revision"
      ? ["problem_resolution_repair_mode_substantial_revision"]
      : []),
  ]);
}

function deriveRequiredActionFloor(input: {
  readonly hardFailureReasons: readonly string[];
  readonly violatedConstraints: readonly string[];
  readonly contradictions: readonly string[];
  readonly repairMode: ProblemResolutionRepairMode | null;
}): CouncilAction | null {
  if (input.contradictions.length > 0) {
    return "block_delivery";
  }

  if (
    input.violatedConstraints.some((constraint) =>
      /formal_|forbidden|observation_limit|action_budget|assignment_rule/i.test(
        constraint,
      ),
    )
  ) {
    return "block_delivery";
  }

  if (input.repairMode === "regenerate") {
    return "regenerate";
  }

  if (input.hardFailureReasons.length > 0) {
    return "regenerate";
  }

  if (input.repairMode === "substantial_revision") {
    return "revise";
  }

  return null;
}

function normalizeRepairMode(
  value: string,
): ProblemResolutionRepairMode | null {
  const normalized = normalizeText(value);

  if (
    normalized === "none" ||
    normalized === "light_repair" ||
    normalized === "substantial_revision" ||
    normalized === "regenerate"
  ) {
    return normalized;
  }

  return null;
}

function flattenBranchMissingAssignments(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return dedupe(
    value.flatMap((entry) => {
      if (!isRecord(entry)) {
        return [];
      }

      const branchId = getString(entry.branchId);
      const missing = toStringArray(entry.missingVariables);

      return missing.map((item) => (branchId ? `${branchId}:${item}` : item));
    }),
  );
}

function getNestedRecordArrayStrings(
  source: unknown,
  path: readonly string[],
  key: string,
): string[] {
  const value = getNestedValue(source, path);

  if (!Array.isArray(value)) {
    return [];
  }

  return dedupe(
    value.flatMap((entry) => {
      if (!isRecord(entry)) {
        return [];
      }

      return getString(entry[key]);
    }),
  );
}

function getNestedStringArray(
  source: unknown,
  path: readonly string[],
): string[] {
  return toStringArray(getNestedValue(source, path));
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

function getNestedString(source: unknown, path: readonly string[]): string {
  return getString(getNestedValue(source, path));
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

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return dedupe(value.map((entry) => getString(entry)));
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function dedupe(values: readonly string[]): string[] {
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
    .replace(/\s+/g, " ")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
