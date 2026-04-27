/**
 * @file layer-audit-recorder.ts
 * @description Converte matriz de ativacao e trace real em registros auditaveis por camada.
 * @layer 19-observability-control-and-admin-layer
 * @purpose Comparar descida planejada com execucao observada.
 * @inputs ProcessingState e modos de camada do AdaptivePipelineContract.
 * @outputs Lista de LayerAuditRecord.
 * @dependsOn bridges/contracts/layer-audit-record, layer-value-scorer.
 * @usedBy pipeline-audit-report-builder.
 * @invariants Apenas observa o estado; nao pode reordenar nem bloquear o pipeline.
 * @notes Uma camada sem trace explicito ainda pode ser registrada a partir da matriz planejada.
 */
import type { ProcessingState } from "../../bridges/contracts/processing-state";
import type { LayerAuditRecord } from "../../bridges/contracts/layer-audit-record";
import { scoreLayerValue } from "./layer-value-scorer";

export function buildLayerAuditRecords(state: ProcessingState): LayerAuditRecord[] {
  const activations = state.adaptivePipelineContract?.layerActivations || {};
  return Object.entries(activations).map(([layer, activation]) => {
    const actions = state.trace
      .filter((event) => event.layer === layer)
      .map((event) => event.action);
    const scored = scoreLayerValue(layer, activation.mode, actions);
    return {
      layer,
      mode: activation.mode,
      executed: actions.length > 0,
      valueAdded: scored.valueAdded,
      estimatedCost: scored.estimatedCost,
      risks: activation.rationale.filter((item) => /risk|fallback|caution|validation/i.test(item)),
      coherenceWithContract: actions.length > 0 || activation.mode === "noop-intelligent" ? 1 : 0.72,
    };
  });
}

