import type { ProcessingState } from "../bridges/contracts/processing-state";

export async function runObservabilityMetricsBridge(state: ProcessingState): Promise<ProcessingState> {
  const byLayer = state.trace.reduce<Record<string, number>>((acc, item) => {
    acc[item.layer] = (acc[item.layer] || 0) + item.latencyMs;
    return acc;
  }, {});

  state.timings = {
    ...state.timings,
    ...Object.fromEntries(Object.entries(byLayer).map(([layer, value]) => [`layer.${layer}`, value])),
  };

  return state;
}
