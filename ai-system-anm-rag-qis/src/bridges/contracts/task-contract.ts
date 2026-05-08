/**
 * @file task-contract.ts
 * @description Define o contrato de tarefa usado antes da geracao da resposta.
 * @layer bridges/contracts
 * @purpose Formalizar objetivo, restricoes, perfil cognitivo e regime de entrega.
 * @inputs TaskNatureState, estado de processamento, selecao de perfil e sinais de orquestracao.
 * @outputs TaskContract serializavel e auditavel.
 * @dependsOn cognitive-task-type, logical-task-adequacy-report.
 * @usedBy adaptive-pipeline-contract-builder, validadores, reflexao e observabilidade.
 * @invariants O contrato descreve a tarefa; ele nao pode substituir a travessia descendente.
 * @notes Campos vazios indicam ausencia de sinal confiavel, nao permissao implicita.
 */
import type { CognitiveTaskType } from "./cognitive-task-type";
import type { LogicalTaskAdequacyReport } from "./logical-task-adequacy-report";

export type TaskRiskLevel = "low" | "medium" | "high";
export type TaskDepthExpectation = "shallow" | "standard" | "deep";
export type TaskDeliveryRegime = "direct" | "stepwise" | "structured" | "grounded" | "dialogical";

export interface TaskContract {
  version: string;
  objective: string;
  cognitiveTaskType: CognitiveTaskType;
  conversationalIntents: string[];
  explicitConstraints: string[];
  logicalAdequacy: LogicalTaskAdequacyReport | null;
  allowedActions: string[];
  prohibitedActions: string[];
  needsMemory: boolean;
  needsRetrieval: boolean;
  needsCounterposition: boolean;
  needsStrongValidation: boolean;
  expectedOutputFormat: string[];
  riskLevel: TaskRiskLevel;
  depthExpectation: TaskDepthExpectation;
  deliveryRegime: TaskDeliveryRegime;
  primaryProfileId: string;
  secondaryProfileIds: string[];
  auditReasons: string[];
}
