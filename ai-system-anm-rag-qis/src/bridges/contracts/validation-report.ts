/**
 * @file validation-report.ts
 * @description Define relatorios especializados de validacao por classe de tarefa.
 * @layer bridges/contracts
 * @purpose Complementar o ValidationReport legado com validacao cognitiva auditavel.
 * @inputs TaskContract, resposta candidata, validadores estruturais e dialogicos.
 * @outputs TaskClassValidationReport e SelfCritiqueReport.
 * @dependsOn cognitive-task-type.
 * @usedBy camada de validacao, observabilidade e feedback.
 * @invariants Validadores devem registrar achados sem apagar os relatórios legados.
 * @notes O verdict retry indica necessidade de reparo; nao executa reparo sozinho.
 */
import type { CognitiveTaskType } from "./cognitive-task-type";

export interface TaskClassValidationFinding {
  validatorId: string;
  severity: "info" | "warning" | "error";
  message: string;
}

export interface TaskClassValidationReport {
  selectedTaskType: CognitiveTaskType;
  validatorsTriggered: string[];
  findings: TaskClassValidationFinding[];
  verdict: "accept" | "retry";
  score: number;
}

export interface SelfCritiqueReport {
  findings: string[];
  shouldRevise: boolean;
  score: number;
}

