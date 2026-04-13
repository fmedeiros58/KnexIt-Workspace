/**
 * ESPECIFICAÇÃO DO ARQUIVO
 * ------------------------
 * Nome: deliberative-task-contract-types.ts
 * Camada: 05b-deliberative-task-contract-layer
 *
 * Responsabilidade principal:
 * - Definir o contrato tipado do módulo deliberativo de tarefas.
 * - Centralizar os tipos compartilhados entre extração, construção de contrato,
 *   validação de cobertura, execução e normalização final.
 * - Fornecer estruturas canônicas e fábricas de estado vazio para inicialização
 *   consistente e auditável do módulo.
 *
 * Função no pipeline:
 * - Este arquivo NÃO executa validação.
 * - Este arquivo NÃO constrói a resposta final.
 * - Este arquivo NÃO aplica regras de superfície por si só.
 * - Este arquivo define a linguagem tipada comum que permite interoperabilidade
 *   entre os demais arquivos do módulo 05b.
 *
 * Garantias esperadas:
 * - Redução de drift estrutural entre builders, validators e bridges.
 * - Padronização das formas de estado inicial.
 * - Clareza auditável sobre entradas, saídas e contratos internos do módulo.
 *
 * Observação arquitetural:
 * - O contrato ReasoningContract pode carregar políticas de superfície
 *   para orientar normalização e entrega, sem que este arquivo implemente
 *   diretamente essa lógica.
 */

export const DELIBERATIVE_TASK_CONTRACT_VERSION = "05b.v2" as const;

export type DeliberativeObligationType =
  | "demonstration"
  | "distinction"
  | "proposal"
  | "evaluation"
  | "explanation"
  | "comparison"
  | "planning"
  | "diagnosis"
  | "decision"
  | "synthesis"
  | "objection"
  | "reformulation"
  | "assumption_audit";

export type DeliberativeTargetMode =
  | "conversational"
  | "argumentative_structured"
  | "formal_analytical";

export type TaskArchetype =
  | "define"
  | "explain"
  | "compare"
  | "demonstrate"
  | "evaluate"
  | "criticize"
  | "plan"
  | "diagnose"
  | "decide"
  | "synthesize"
  | "formalize"
  | "decompose"
  | "propose_alternatives"
  | "estimate"
  | "review_assumptions"
  | "construct_objection"
  | "reconcile_competing_criteria";

export type CognitiveDemand =
  | "causal_reasoning"
  | "tradeoff_analysis"
  | "constraint_satisfaction"
  | "uncertainty_handling"
  | "multi_step_execution"
  | "proof_or_justification"
  | "counter_argumentation"
  | "model_comparison"
  | "synthesis";

export type AssumptionLedgerCategory =
  | "definition_operational"
  | "comparability"
  | "measurability"
  | "institutional_stability"
  | "applicability_condition"
  | "moral_category"
  | "selection_criterion";

export type PromptConstraintType =
  | "no_authors"
  | "no_theories"
  | "no_historical_examples"
  | "no_concrete_examples_initially"
  | "item_by_item_execution"
  | "assumptions_only_at_end"
  | "unknown";

export type NormativeStrength = "strong" | "moderate";

export type DeliberativeGateLevel = "pass" | "soft_fail" | "hard_fail";

/**
 * Política de superfície da resposta.
 * Define garantias para impedir que o scaffold deliberativo interno
 * vaze para a resposta final entregue ao usuário.
 */
export interface ResponseSurfacePolicy {
  preserveUserLanguage: boolean;
  forbidPersonaInjection: boolean;
  hideMetaInstructions: boolean;
  avoidEnumeratedScaffolding: boolean;
  preferNaturalParagraphFlow: boolean;
  blockIfAbruptlyTruncated: boolean;
}

export interface CognitiveDemandProfile {
  taskArchetypes: TaskArchetype[];
  cognitiveDemands: CognitiveDemand[];
  reasoningIntensity: number;
  structuralComplexity: number;
  answerFormatNeeds: string[];
  requiresDeliberativeContract: boolean;
  requiresFormalization: boolean;
  requiresAlternatives: boolean;
  requiresSelfObjection: boolean;
  requiresAssumptionAudit: boolean;
  requiresStructuredCoverage: boolean;
}

export interface ArgumentativeDepthResult {
  requiresDeliberativeContract: boolean;
  argumentativeDepthScore: number;
  needsFormalization: boolean;
  needsCounterObjection: boolean;
  needsAssumptionAudit: boolean;
  needsStructuredCoverage: boolean;
  activationReasons?: string[];
}

export interface DeliberativeObligation {
  obligationId: string;
  label: string;
  type: DeliberativeObligationType;
  priority: number;
  dependencies: string[];
  satisfactionCriteria: string[];
  minimumExpectedDepth: number;
  coverageWeight?: number;
  evidenceHints?: string[];
}

export interface ReasoningContract {
  targetMode: DeliberativeTargetMode;
  responseArchitecture: string;
  requiredSections: string[];
  requiredTransitions: string[];
  prohibitedShortcuts: string[];
  proofDemandLevel: number;
  objectionStrengthLevel: number;
  uncertaintyHandlingMode: string;
  assumptionDisclosureMode: string;
  minCoverageThreshold: number;
  preferredAnswerOrder?: string[];
  terminationCriteria?: string[];
  surfacePolicy?: ResponseSurfacePolicy;
}

export interface ProofSkeleton {
  definitions: string[];
  predicates: string[];
  thesis: string[];
  proofSteps: string[];
  distinctions: string[];
  objectionTargets: string[];
  reformulationTargets: string[];
  dependencyGraph?: Array<{
    from: string;
    to: string;
    rationale: string;
  }>;
}

export interface SolutionModel {
  id: string;
  title: string;
  normativeCore: string;
  operationalMechanism: string;
  leastSacrificedPrinciple: string;
  mostTensionedPrinciple: string;
  logicalRisk: string;
  moralRisk: string;
  institutionalRisk: string;
  comparativeAdvantage?: string;
}

export interface AssumptionLedgerEntry {
  id: string;
  category: AssumptionLedgerCategory;
  statement: string;
}

export interface ObligationExecutionPlanItem {
  obligationId: string;
  type: DeliberativeObligationType;
  minimumExpectedDepth: number;
}

export interface ObligationSatisfactionScore {
  obligationId: string;
  label: string;
  type: DeliberativeObligationType;
  score: number;
  passed: boolean;
  issues: string[];
}

export interface PromptConstraint {
  id: string;
  type: PromptConstraintType;
  description: string;
  hard: boolean;
}

export interface PremiseLedgerEntry {
  id: string;
  text: string;
  coreTerms: string[];
  normativeStrength: NormativeStrength;
}

export interface NoveltyMetrics {
  inputOverlapScore: number;
  noveltyScore: number;
  restatementRisk: number;
}

export interface DemonstrationCheck {
  name: string;
  passed: boolean;
  score?: number;
  issues: string[];
}

export interface IntegrityChecks {
  isTruncated: boolean;
  hasAbruptEnding: boolean;
  missingSections: string[];
  issues: string[];
}

export interface FinalExecutionGate {
  shouldBlock: boolean;
  blockReasons: string[];
}

export interface SubtaskCoverageDiagnostics {
  expected: number;
  satisfied: number;
  missing: string[];
  weak: string[];
  passed: boolean;
}

export interface ExecutionDiagnostics {
  inputOverlapScore: number;
  noveltyScore: number;
  restatementRisk: number;
  promptConstraints: string[];
  constraintViolations: string[];
  premiseLedger: string[];
  premiseViolations: string[];
  proofVsIllustrationScore: number;
  proofVsIllustrationIssues: string[];
  integrityChecks: IntegrityChecks;
  subtaskCoverage: SubtaskCoverageDiagnostics;
  finalExecutionGate: FinalExecutionGate;
}

export interface CoverageReport {
  expected: number;
  satisfied: number;
  missing: string[];
  weaklySatisfied: string[];
  needsRevision: boolean;
  obligationScores?: ObligationSatisfactionScore[];
  blockingIssues?: string[];
  gateLevel?: DeliberativeGateLevel;
  executionDiagnostics?: ExecutionDiagnostics;
}

export interface TaskExecutionState {
  detectedObligations: string[];
  obligationExecutionPlan: ObligationExecutionPlanItem[];
  obligationSatisfactionScores: ObligationSatisfactionScore[];
  promptConstraints: PromptConstraint[];
  premiseLedger: PremiseLedgerEntry[];
  noveltyMetrics: NoveltyMetrics;
  demonstrationChecks: DemonstrationCheck[];
  integrityChecks: IntegrityChecks;
  finalExecutionGate: FinalExecutionGate;
}

export interface DeliberativeTaskState {
  isActive: boolean;
  taskArchetypes: TaskArchetype[];
  cognitiveDemands: CognitiveDemand[];
  reasoningIntensity: number;
  structuralComplexity: number;
  answerFormatNeeds: string[];
  argumentativeDepthScore: number;
  requiresFormalization: boolean;
  requiresCoverageAudit: boolean;
  obligationGraph: DeliberativeObligation[];
  reasoningContract: ReasoningContract | null;
  proofSkeleton: ProofSkeleton | null;
  solutionModels: SolutionModel[];
  assumptionLedger: AssumptionLedgerEntry[];
  coverageReport: CoverageReport;
  taskExecutionState: TaskExecutionState;
  strongestSelfObjection: string | null;
  activationReasons?: string[];
  contractVersion?: string;
}

export type GeneralTaskDeliberationState = DeliberativeTaskState;

export function createEmptyNoveltyMetrics(): NoveltyMetrics {
  return {
    inputOverlapScore: 0,
    noveltyScore: 1,
    restatementRisk: 0,
  };
}

export function createEmptyIntegrityChecks(): IntegrityChecks {
  return {
    isTruncated: false,
    hasAbruptEnding: false,
    missingSections: [],
    issues: [],
  };
}

export function createEmptyFinalExecutionGate(): FinalExecutionGate {
  return {
    shouldBlock: false,
    blockReasons: [],
  };
}

export function createEmptySubtaskCoverageDiagnostics(): SubtaskCoverageDiagnostics {
  return {
    expected: 0,
    satisfied: 0,
    missing: [],
    weak: [],
    passed: true,
  };
}

export function createEmptyExecutionDiagnostics(): ExecutionDiagnostics {
  return {
    inputOverlapScore: 0,
    noveltyScore: 1,
    restatementRisk: 0,
    promptConstraints: [],
    constraintViolations: [],
    premiseLedger: [],
    premiseViolations: [],
    proofVsIllustrationScore: 0,
    proofVsIllustrationIssues: [],
    integrityChecks: createEmptyIntegrityChecks(),
    subtaskCoverage: createEmptySubtaskCoverageDiagnostics(),
    finalExecutionGate: createEmptyFinalExecutionGate(),
  };
}

export function createEmptyTaskExecutionState(): TaskExecutionState {
  return {
    detectedObligations: [],
    obligationExecutionPlan: [],
    obligationSatisfactionScores: [],
    promptConstraints: [],
    premiseLedger: [],
    noveltyMetrics: createEmptyNoveltyMetrics(),
    demonstrationChecks: [],
    integrityChecks: createEmptyIntegrityChecks(),
    finalExecutionGate: createEmptyFinalExecutionGate(),
  };
}

export function createEmptyCoverageReport(): CoverageReport {
  return {
    expected: 0,
    satisfied: 0,
    missing: [],
    weaklySatisfied: [],
    needsRevision: false,
    obligationScores: [],
    blockingIssues: [],
    gateLevel: "pass",
    executionDiagnostics: createEmptyExecutionDiagnostics(),
  };
}

export function createInactiveDeliberativeTaskState(): DeliberativeTaskState {
  return {
    isActive: false,
    taskArchetypes: [],
    cognitiveDemands: [],
    reasoningIntensity: 0,
    structuralComplexity: 0,
    answerFormatNeeds: [],
    argumentativeDepthScore: 0,
    requiresFormalization: false,
    requiresCoverageAudit: false,
    obligationGraph: [],
    reasoningContract: null,
    proofSkeleton: null,
    solutionModels: [],
    assumptionLedger: [],
    coverageReport: createEmptyCoverageReport(),
    taskExecutionState: createEmptyTaskExecutionState(),
    strongestSelfObjection: null,
    activationReasons: [],
    contractVersion: DELIBERATIVE_TASK_CONTRACT_VERSION,
  };
}

export function isDeliberativeTaskActive(
  state: DeliberativeTaskState | null | undefined,
): boolean {
  if (!state?.isActive) {
    return false;
  }

  return (
    state.obligationGraph.length > 0 ||
    state.taskArchetypes.length > 0 ||
    state.cognitiveDemands.length > 0 ||
    state.reasoningContract !== null ||
    state.proofSkeleton !== null ||
    state.argumentativeDepthScore > 0
  );
}