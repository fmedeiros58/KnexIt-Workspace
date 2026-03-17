/**
 * Responsabilidade do arquivo:
 * - Registrar decisoes executed/skipped por camada no trace.
 * - Atualizar metricas agregadas de observabilidade por camada e motivo.
 * - Padronizar detalhe de motivo para auditoria do fluxo descendente.
 */
import type { ProcessingState } from "../../bridges/contracts/processing-state";
import type { PipelineLayerId, PipelineRoute } from "../enums/pipeline-enums";
import { makeTraceEvent } from "./trace-utils";
import {
  bumpLayerExecuted,
  bumpLayerSkipped,
  createObservabilityMetricsStore,
} from "../../19-observability-control-and-admin-layer/observability-metrics-store";

export interface LayerDecisionTraceInput {
  layer: PipelineLayerId;
  route: PipelineRoute;
  status: "executed" | "skipped";
  reason: string;
  latencyMs?: number;
  detail?: string;
}

export function pushLayerDecisionTrace(
  state: ProcessingState,
  input: LayerDecisionTraceInput,
) {
  state.trace.push(
    makeTraceEvent({
      layer: input.layer,
      action: `layer_${input.status}`,
      route: input.route,
      latencyMs: input.latencyMs ?? 0,
      detail: `reason=${input.reason}${input.detail ? `; ${input.detail}` : ""}`,
    }),
  );

  state.observabilityMetrics = state.observabilityMetrics || createObservabilityMetricsStore();

  if (input.status === "executed") {
    bumpLayerExecuted(state.observabilityMetrics, input.layer);
  } else {
    bumpLayerSkipped(state.observabilityMetrics, input.layer, input.reason);
  }
}
