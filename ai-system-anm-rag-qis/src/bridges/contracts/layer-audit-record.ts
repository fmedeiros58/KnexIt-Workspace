/**
 * @file layer-audit-record.ts
 * @description Define o registro auditavel de uma camada durante a descida.
 * @layer bridges/contracts
 * @purpose Medir modo, valor incremental, custo e riscos por camada.
 * @inputs LayerActivation, eventos de trace e artefatos de execucao.
 * @outputs LayerAuditRecord.
 * @dependsOn layer-mode.
 * @usedBy architectural-audit e observability-layer.
 * @invariants O registro deve observar a camada; nao deve reexecutar nem redirecionar fluxo.
 * @notes Usado para comparar descida teorica e execucao real.
 */
import type { LayerMode } from "./layer-mode";

export interface LayerAuditRecord {
  layer: string;
  mode: LayerMode | string;
  executed: boolean;
  valueAdded: string[];
  estimatedCost: "low" | "medium" | "high";
  risks: string[];
  coherenceWithContract: number;
}

