import type { DeliveryBuildResult, SerializedPresentation } from "../presentation-contracts";

export interface RestDeliveryInput {
  serialized: SerializedPresentation;
  citations: string[];
  retryPolicy: DeliveryBuildResult["retryPolicy"];
}

export function restDelivery(input: RestDeliveryInput): DeliveryBuildResult {
  return {
    channel: "rest",
    format: input.serialized.format,
    text: input.serialized.text,
    payload: {
      mode: "rest",
      format: input.serialized.format,
      body: input.serialized.text,
      serializedPayload: input.serialized.payload,
      citations: input.citations,
    },
    retryPolicy: input.retryPolicy,
  };
}
