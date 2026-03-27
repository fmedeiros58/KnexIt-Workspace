import type { ProcessingState } from "../bridges/contracts/processing-state";
import { restDelivery } from "./front-delivery-layer/rest-delivery";
import { retryReconnectHandler } from "./front-delivery-layer/retry-reconnect-handler";
import { sseDelivery } from "./front-delivery-layer/sse-delivery";
import { websocketDelivery } from "./front-delivery-layer/websocket-delivery";
import type { DeliveryBuildResult, DeliveryChannel, SerializedPresentation } from "./presentation-contracts";
import type { StreamChunkSerializerOutput } from "./output-serializer/stream-chunk-serializer";

export interface PresentationFrontBridgeInput {
  channel: DeliveryChannel;
  serialized: SerializedPresentation;
  citations: string[];
  stream: StreamChunkSerializerOutput;
}

export interface PresentationFrontBridgeOutput {
  delivery: DeliveryBuildResult;
  retryPolicy: DeliveryBuildResult["retryPolicy"];
}

export function buildPresentationFrontDelivery(input: PresentationFrontBridgeInput): PresentationFrontBridgeOutput {
  const retry = retryReconnectHandler();
  if (input.channel === "sse") {
    return {
      delivery: sseDelivery({
        serializedText: input.serialized.text,
        stream: input.stream,
        retryPolicy: retry.policy,
      }),
      retryPolicy: retry.policy,
    };
  }

  if (input.channel === "websocket") {
    return {
      delivery: websocketDelivery({
        serializedText: input.serialized.text,
        stream: input.stream,
        retryPolicy: retry.policy,
      }),
      retryPolicy: retry.policy,
    };
  }

  return {
    delivery: restDelivery({
      serialized: input.serialized,
      citations: input.citations,
      retryPolicy: retry.policy,
    }),
    retryPolicy: retry.policy,
  };
}

export function handoffPresentationToFront(state: ProcessingState): ProcessingState {
  return state;
}
