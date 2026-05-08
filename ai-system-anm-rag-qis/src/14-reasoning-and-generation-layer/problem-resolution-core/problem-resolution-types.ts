/**
 * Layer: 14-reasoning-and-generation-layer/problem-resolution-core
 * Module: problem-resolution-types
 * Responsibility: Shared contracts for reasoning completeness analysis.
 */

export type ReasoningNeed =
  | "none"
  | "light"
  | "moderate"
  | "high"
  | "formal_required";

export type LogicalProblemKind =
  | "unknown"
  | "mapping_problem"
  | "constraint_satisfaction"
  | "single_action_inference"
  | "observation_limited_reasoning"
  | "deductive_elimination"
  | "case_analysis"
  | "truth_table"
  | "ordering_problem"
  | "assignment_problem"
  | "calculation_problem"
  | "comparison_problem";

export type RepairMode =
  | "none"
  | "light_repair"
  | "substantial_revision"
  | "regenerate";

export type ReasoningRiskType =
  | "abandoned_constraint"
  | "unresolved_variable"
  | "unsupported_conclusion"
  | "incomplete_case_analysis"
  | "category_shift"
  | "language_shift"
  | "loop_or_repetition"
  | "premature_closure"
  | "forbidden_action"
  | "observation_limit_violation"
  | "assignment_inconsistency"
  | "proof_obligation_missing";

export type ReasoningRiskSeverity = "low" | "medium" | "high";

export type ProofObligationCategory =
  | "preserve_constraint"
  | "cover_scenario"
  | "assign_variable"
  | "justify_elimination"
  | "validate_mapping"
  | "avoid_forbidden_action"
  | "support_conclusion";

export type ObservationLimitType =
  | "no_hidden_inspection"
  | "no_additional_observation"
  | "single_observation_only"
  | "limited_source_access"
  | "unknown";

export type ActionBudgetKind =
  | "sample"
  | "inspect"
  | "ask"
  | "choose"
  | "move"
  | "test"
  | "measure"
  | "observe"
  | "unknown";

export interface ActionBudget {
  /**
   * Maximum number of allowed operations.
   * Example: only one operation, exactly one attempt, at most one action.
   */
  maxActions?: number;

  /**
   * Legacy-compatible action category.
   * Prefer "unknown" when the system should not bind the budget to a concrete domain action.
   */
  actionType?: ActionBudgetKind;

  /**
   * Maximum number of targets that may receive the operation.
   */
  targetLimit?: number;

  /**
   * Whether the bounded operation can be repeated.
   */
  repeatAllowed?: boolean;

  /**
   * Original signals that justified the budget extraction.
   */
  rawSignals: string[];

  /**
   * Optional abstraction metadata.
   * These fields allow the extractor to represent an operation limit without hardcoding the domain.
   */
  boundedOperatorPhrase?: string;
  boundedTargetPhrase?: string;
  quantifier?: "only" | "at_most" | "exactly" | "single" | "unknown";
  expansionAllowed?: boolean;
}

export interface ObservationLimit {
  type: ObservationLimitType;

  /**
   * Scope should stay abstract whenever possible.
   * Example: "unselected_or_hidden_scope", "additional_information", "limited_source_access".
   */
  scope?: string;

  /**
   * Original signals that justified the observation/access limit.
   */
  rawSignals: string[];
}

export interface DomainMapping {
  /**
   * Variables are abstract entities that require assignment.
   */
  variables: string[];

  /**
   * Domains are possible values, attributes, states, labels, classes or results.
   */
  domains: string[];

  /**
   * Optional known assignments.
   */
  assignments?: Record<string, string>;

  /**
   * Generic rules such as:
   * mapping_required, determine_all, each_variable_gets_one_value,
   * values_used_once, exclusive_assignment.
   */
  assignmentRules: string[];
}

export interface ScenarioBranch {
  id: string;
  condition: string;
  expectedCoverageSignals: string[];
  resolved?: boolean;
}

export interface ProofObligation {
  id: string;
  description: string;
  category: ProofObligationCategory;
  satisfied?: boolean;
}

export interface ScenarioCoverageResult {
  requiredBranches: string[];
  coveredBranches: string[];
  missingBranches: string[];
  passed: boolean;
}

export interface AssignmentConsistencyResult {
  allVariablesAssigned: boolean;
  duplicateAssignments: string[];
  missingAssignments: string[];
  violatedAssignmentRules: string[];
  passed: boolean;
}

export interface ProofObligationEvaluation {
  satisfied: string[];
  missing: string[];
  risks: ReasoningRisk[];
}

export interface ProblemResolutionInput {
  userInput: string;
  detectedIntent?: string;
  taskContract?: unknown;
  sessionContext?: string[];
  memoryContext?: string[];
  evidence?: string[];
  responsePlan?: string[];
  reflectiveSignals?: string[];
  inferentialSignals?: string[];
  metacognitiveSignals?: string[];
  epistemicSignals?: string[];
  draftAnswer?: string;
  languageHint?: string;
}

export interface ProblemRepresentation {
  userGoal: string;
  taskType: string;
  logicalProblemKind?: LogicalProblemKind;

  entities: string[];
  variables: string[];

  explicitConstraints: string[];
  implicitConstraints: string[];
  invariants: string[];

  requiredOutputs: string[];
  formatRequirements: string[];
  language: string;

  completionObligations: string[];
  unknowns: string[];
  assumptions: string[];

  actionBudget?: ActionBudget;
  observationLimits?: ObservationLimit[];
  domainMapping?: DomainMapping;
  scenarioBranches?: ScenarioBranch[];

  closureRequirements?: string[];
  proofObligations?: ProofObligation[];

  assignmentConsistency?: AssignmentConsistencyResult;
  scenarioCoverage?: ScenarioCoverageResult;
}

export interface ReasoningScenario {
  id: string;
  description: string;
  assumptions: string[];
  applicableConstraints: string[];
  valid: boolean | null;
  invalidReason?: string;
  conclusion?: string;
}

export interface LogicalClosureAssessment {
  passed: boolean;
  missingVariables: string[];
  violatedConstraints: string[];
  unresolvedScenarios: string[];
  unsupportedConclusions: string[];
  contradictions: string[];
  completionScore: number;
  missingProofObligations?: string[];
}

export interface ReasoningRisk {
  type: ReasoningRiskType;
  severity: ReasoningRiskSeverity;
  message: string;
}

export interface DraftRepairPlan {
  requiresRepair: boolean;
  repairReasons: string[];
  repairInstructions: string[];
  repairMode?: RepairMode;
}

export interface ProblemResolutionReport {
  missingObligations: string[];
  missingProofObligations?: string[];
  unresolvedScenarios: string[];
  violatedConstraints: string[];
  unsupportedConclusions: string[];
}

export interface ProblemResolutionState {
  reasoningNeed: ReasoningNeed;
  userGoal: string;
  taskType: string;
  logicalProblemKind?: LogicalProblemKind;

  entities: string[];
  variables: string[];

  explicitConstraints: string[];
  implicitConstraints: string[];
  invariants: string[];

  scenarios: ReasoningScenario[];
  scenarioBranches?: ScenarioBranch[];

  completionObligations: string[];
  closureRequirements?: string[];

  unresolvedVariables: string[];
  assumptions: string[];

  actionBudget?: ActionBudget;
  observationLimits?: ObservationLimit[];
  domainMapping?: DomainMapping;

  proofObligations?: ProofObligation[];
  scenarioCoverage?: ScenarioCoverageResult;
  assignmentConsistency?: AssignmentConsistencyResult;
  proofEvaluation?: ProofObligationEvaluation;

  risks: ReasoningRisk[];
  closure: LogicalClosureAssessment;

  repairPlan?: DraftRepairPlan;
  repairMode?: RepairMode;
  repairApplied?: boolean;
  repairInstructions: string[];

  representation: ProblemRepresentation;
  constraintLedger: string[];

  report: ProblemResolutionReport;
}
