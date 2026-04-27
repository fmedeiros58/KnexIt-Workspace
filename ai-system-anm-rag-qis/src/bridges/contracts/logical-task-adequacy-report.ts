/**
 * @file logical-task-adequacy-report.ts
 * @description Define o diagnostico auditavel de adequacao logica usado por tarefas fechadas e deterministicas.
 * @layer bridges/contracts
 * @purpose Representar restricoes logicas, orcamento de acoes e estrategias proibidas sem hardcode de enigmas especificos.
 * @inputs Natureza cognitiva da tarefa, enunciado normalizado e restricoes explicitas extraidas.
 * @outputs LogicalTaskAdequacyReport serializavel para TaskContract, validadores, prompt e auditoria.
 * @dependsOn cognitive-task-type.
 * @usedBy task-contract-builder, validadores de classe e construcao de prompt.
 * @invariants O relatorio diagnostica o regime logico; ele nao executa a solucao nem substitui o pipeline descendente.
 * @notes A deteccao e heuristica conservadora para barrar exploracao indevida quando ha sinais de mundo fechado.
 */
import type { CognitiveTaskType } from "./cognitive-task-type";

export type LogicalTaskRegime =
  | "closed_constraint_deduction"
  | "short_deterministic_reasoning"
  | "open_exploration"
  | "non_logical";

export type LogicalForbiddenStrategy =
  | "iterative_exploration"
  | "random_choice"
  | "extra_observation"
  | "premise_relaxation"
  | "discursive_plausibility";

export type LogicalRequiredReasoningMove =
  | "extract_constraints"
  | "respect_action_budget"
  | "identify_pivot"
  | "deduce_by_elimination"
  | "check_completeness"
  | "answer_directly";

export interface LogicalActionBudget {
  maxActions: number | null;
  maxObservations: number | null;
  source: string | null;
}

export interface LogicalTaskAdequacyReport {
  version: string;
  sourceTaskType: CognitiveTaskType;
  regime: LogicalTaskRegime;
  isClosedWorld: boolean;
  isDeterministic: boolean;
  requiresConstraintProof: boolean;
  requiresPivotSelection: boolean;
  actionBudget: LogicalActionBudget;
  extractedRestrictions: string[];
  forbiddenStrategies: LogicalForbiddenStrategy[];
  requiredReasoningMoves: LogicalRequiredReasoningMove[];
  auditSignals: string[];
  confidence: number;
}
