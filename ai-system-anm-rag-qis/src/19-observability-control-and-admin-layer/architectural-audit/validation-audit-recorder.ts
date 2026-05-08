/**
 * @file validation-audit-recorder.ts
 * @description Resume validacao por classe e autocritica para auditoria.
 * @layer 19-observability-control-and-admin-layer
 * @purpose Registrar validadores acionados, achados e decisao final.
 * @inputs ProcessingState com executionArtifacts.validation.
 * @outputs Objeto serializavel de auditoria de validacao.
 * @dependsOn bridges/contracts/processing-state.
 * @usedBy pipeline-audit-report-builder.
 * @invariants Nao deve recalcular validacao nem alterar decision.
 * @notes Usa os achados ja produzidos pela camada 17.
 */
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function buildValidationAuditRecord(state: ProcessingState): Record<string, unknown> {
  const validation = state.executionArtifacts.validation;
  return {
    validatorsTriggered: validation?.validatorsTriggered || [],
    taskClassValidationIssues: validation?.taskClassValidationIssues || [],
    selfCritiqueFindings: validation?.selfCritiqueFindings || [],
    finalDecision: state.validationReport.quality.decision,
  };
}

