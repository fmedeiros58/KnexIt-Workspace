import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";

export async function runPresentationLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  state.deliveryPayload = {
    channel: "rest",
    format: "plain-text",
    text: state.structuredResponse,
    citations: state.retrievedSources.map((source) => source.url),
  };
  state.trace.push(
    makeTraceEvent({
      layer: "presentation",
      action: "delivery_payload_ready",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
    }),
  );
  return state;
}
