/**
 * @file pipeline-audit-report.ts
 * @description Define o relatorio consolidado de auditoria da descida adaptativa.
 * @layer bridges/contracts
 * @purpose Registrar classificacao, perfil, matriz, validadores, autocritica e integridade.
 * @inputs TaskNatureState, TaskContract, AdaptivePipelineContract, validacao e traces.
 * @outputs PipelineAuditReport.
 * @dependsOn task-nature-state, task-contract, layer-audit-record, validation-report.
 * @usedBy observability-layer, feedback-layer e revisores humanos.
 * @invariants A auditoria deve ser explicativa e nao pode alterar o resultado da camada.
 * @notes O relatorio e desenhado para comparacao entre descida teorica e execucao real.
 */
import type { TaskNatureState } from "./task-nature-state";
import type { TaskContract } from "./task-contract";
import type { LayerAuditRecord } from "./layer-audit-record";
import type { SelfCritiqueReport, TaskClassValidationReport } from "./validation-report";

export interface PipelineAuditReport {
  version: string;
  selectedTaskType: string;
  selectedProfile: string;
  secondaryProfiles: string[];
  taskNature: TaskNatureState | null;
  taskContract: TaskContract | null;
  layerActivationMap: Record<string, string>;
  layerAuditRecords: LayerAuditRecord[];
  validatorsTriggered: string[];
  validationReport: TaskClassValidationReport | null;
  selfCritique: SelfCritiqueReport | null;
  dialogicalTension: string;
  confidence: number;
  fallbackEvidence: string[];
  risks: string[];
  transitionIntegrity: {
    ok: boolean;
    issues: string[];
  };
}

