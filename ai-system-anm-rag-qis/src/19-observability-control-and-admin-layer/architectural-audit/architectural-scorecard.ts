/**
 * @file architectural-scorecard.ts
 * @description Calcula scorecard compacto de auditabilidade da descida adaptativa.
 * @layer 19-observability-control-and-admin-layer
 * @purpose Fornecer uma medida simples de confianca arquitetural para revisao.
 * @inputs Integridade, validacao e registros por camada.
 * @outputs Score numerico e riscos agregados.
 * @dependsOn layer-audit-record.
 * @usedBy pipeline-audit-report-builder.
 * @invariants Scorecard e diagnostico; nao deve decidir resposta final.
 * @notes Penaliza ausencia de contrato e erros de validacao por classe.
 */
import type { LayerAuditRecord } from "../../bridges/contracts/layer-audit-record";

export function buildArchitecturalScorecard(input: {
  integrityOk: boolean;
  validationIssueCount: number;
  layerAuditRecords: LayerAuditRecord[];
}): { confidence: number; risks: string[] } {
  const averageLayerCoherence = input.layerAuditRecords.length
    ? input.layerAuditRecords.reduce((sum, record) => sum + record.coherenceWithContract, 0) / input.layerAuditRecords.length
    : 0.5;
  const confidence = Number(Math.max(0, Math.min(1, averageLayerCoherence - (input.validationIssueCount * 0.04) - (input.integrityOk ? 0 : 0.25))).toFixed(4));
  return {
    confidence,
    risks: [
      ...(!input.integrityOk ? ["transition_integrity_issue"] : []),
      ...(input.validationIssueCount > 0 ? [`validation_issues:${input.validationIssueCount}`] : []),
    ],
  };
}

