/**
 * @file pipeline-audit-report-builder.ts
 * @description Constroi o relatorio consolidado de auditoria cognitiva e arquitetural.
 * @layer 19-observability-control-and-admin-layer
 * @purpose Registrar classificacao, perfil, matriz, validadores, autocritica e riscos.
 * @inputs ProcessingState apos validacao e antes do feedback.
 * @outputs PipelineAuditReport.
 * @dependsOn pipeline-audit-report, coletores de task nature, perfil, validacao e integridade.
 * @usedBy observability-layer-bridge e feedback-layer.
 * @invariants A auditoria nao altera a resposta nem quebra a ordem descendente.
 * @notes O relatorio facilita revisao humana e aprendizado arquitetural futuro.
 */
import type { PipelineAuditReport } from "../../bridges/contracts/pipeline-audit-report";
import type { ProcessingState } from "../../bridges/contracts/processing-state";
import { buildArchitecturalScorecard } from "./architectural-scorecard";
import { buildLayerAuditRecords } from "./layer-audit-recorder";
import { checkTransitionIntegrity } from "./transition-integrity-checker";

export function buildPipelineAuditReport(state: ProcessingState): PipelineAuditReport {
  const layerActivationMap = Object.fromEntries(
    Object.entries(state.adaptivePipelineContract?.layerActivations || {}).map(([layer, activation]) => [layer, activation.mode]),
  );
  const layerAuditRecords = buildLayerAuditRecords(state);
  const transitionIntegrity = checkTransitionIntegrity(state);
  const validationReport = state.executionArtifacts.validation?.taskClassValidationReport || null;
  const selfCritique = state.executionArtifacts.validation?.selfCritiqueReport || null;
  const scorecard = buildArchitecturalScorecard({
    integrityOk: transitionIntegrity.ok,
    validationIssueCount: validationReport?.findings.length || 0,
    layerAuditRecords,
  });

  return {
    version: "19.pipeline-audit-report.v1",
    selectedTaskType: state.taskNatureState?.selectedTaskType || "unknown",
    selectedProfile: state.profileSelectionResult?.primaryProfileId || "none",
    secondaryProfiles: state.profileSelectionResult?.selectedProfileIds.filter((id) => id !== state.profileSelectionResult?.primaryProfileId) || [],
    taskNature: state.taskNatureState,
    taskContract: state.taskContract,
    layerActivationMap,
    layerAuditRecords,
    validatorsTriggered: state.executionArtifacts.validation?.validatorsTriggered || [],
    validationReport,
    selfCritique,
    dialogicalTension: state.taskContract?.needsCounterposition ? "medium" : "low",
    confidence: scorecard.confidence,
    fallbackEvidence: state.adaptivePipelineContract?.fallbackEvidence || [],
    risks: scorecard.risks,
    transitionIntegrity,
  };
}

