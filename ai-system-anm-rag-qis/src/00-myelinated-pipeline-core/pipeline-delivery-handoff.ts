import type { ProcessingState } from "../bridges/contracts/processing-state";

export function handoffPipelineDelivery(state: ProcessingState) {
  state.deliveryPayload.text = state.structuredResponse || state.deliveryPayload.text;
  state.deliveryPayload.citations = state.retrievedSources.map((source) => source.url);
  return state;
}
