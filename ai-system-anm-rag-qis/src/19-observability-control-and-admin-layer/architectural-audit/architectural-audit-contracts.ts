/**
 * @file architectural-audit-contracts.ts
 * @description Reexporta contratos canonicos usados pela auditoria arquitetural.
 * @layer 19-observability-control-and-admin-layer
 * @purpose Manter a camada de observabilidade alinhada aos contratos em bridges/contracts.
 * @inputs Contratos de auditoria compartilhados.
 * @outputs Tipos reexportados para coletores da camada 19.
 * @dependsOn bridges/contracts/pipeline-audit-report, layer-audit-record e validation-report.
 * @usedBy pipeline-audit-report-builder e consumidores administrativos.
 * @invariants Este arquivo nao deve definir um segundo modelo concorrente de auditoria.
 * @notes Fachada intencional para reduzir acoplamento de caminhos nas ferramentas de auditoria.
 */
export type { PipelineAuditReport } from "../../bridges/contracts/pipeline-audit-report";
export type { LayerAuditRecord } from "../../bridges/contracts/layer-audit-record";
export type { SelfCritiqueReport, TaskClassValidationReport } from "../../bridges/contracts/validation-report";

