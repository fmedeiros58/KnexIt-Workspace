import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { runObservabilityMetricsBridge } from "./observability-metrics-bridge";
import { runObservabilitySqlBridge } from "./observability-sql-bridge";

export async function runObservabilityLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();

  await runObservabilityMetricsBridge(state);
  await runObservabilitySqlBridge(state);

  const totalTraceLatency = state.trace.reduce((sum, item) => sum + item.latencyMs, 0);
  const uniqueLayers = new Set(state.trace.map((item) => item.layer));
  state.timings.total = totalTraceLatency;
  state.timings.traceEvents = state.trace.length;
  state.timings.layerCount = uniqueLayers.size;

  state.trace.push(
    makeTraceEvent({
      layer: "observability",
      action: "trace_and_metrics_compiled",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail: `events=${state.trace.length}; layers=${uniqueLayers.size}; totalLatency=${totalTraceLatency}`,
    }),
  );
  return state;
}
