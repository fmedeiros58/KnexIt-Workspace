import type { ProcessingState } from "../bridges/contracts/processing-state";

function isPublicCitationUrl(url: string) {
  return /^https?:\/\//i.test(`${url || ""}`.trim());
}

export function handoffPipelineDelivery(state: ProcessingState) {
  const structured = `${state.structuredResponse || ""}`.trim();
  if (structured) {
    state.deliveryPayload.text = structured;
  }

  const hasPresentationCitations =
    Array.isArray(state.deliveryPayload.citations) && state.deliveryPayload.citations.length > 0;

  if (!hasPresentationCitations) {
    state.deliveryPayload.citations = state.retrievedSources
      .map((source) => `${source.url || ""}`.trim())
      .filter((url) => isPublicCitationUrl(url));
  }

  return state;
}
