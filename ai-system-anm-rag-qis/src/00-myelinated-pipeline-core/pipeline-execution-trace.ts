import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";

export function appendPipelineTrace(state: ProcessingState, action: string, layer: Parameters<typeof makeTraceEvent>[0]["layer"], latencyMs = 0, detail?: string) {
  state.trace.push(
    makeTraceEvent({
      layer,
      action,
      route: state.executionPlan.selectedRoute,
      latencyMs,
      detail,
    }),
  );
  return state;
}
