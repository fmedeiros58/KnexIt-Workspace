import type { DeliveryBuildResult } from "../presentation-contracts";
import type { StreamChunkSerializerOutput } from "../output-serializer/stream-chunk-serializer";

export interface WebsocketDeliveryInput {
  serializedText: string;
  stream: StreamChunkSerializerOutput;
  retryPolicy: DeliveryBuildResult["retryPolicy"];
}

export function websocketDelivery(input: WebsocketDeliveryInput): DeliveryBuildResult {
  const text =
    input.stream.text ||
    JSON.stringify({
      type: "message",
      text: input.serializedText,
      done: true,
    });

  return {
    channel: "websocket",
    format: "json-block",
    text,
    payload: {
      mode: "websocket",
      format: "json-block",
      text: input.serializedText,
      streamChunkCount: input.stream.chunkCount,
      retryPolicy: input.retryPolicy,
    },
    retryPolicy: input.retryPolicy,
  };
}
