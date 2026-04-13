import type { DeliveryBuildResult } from "../presentation-contracts";
import type { StreamChunkSerializerOutput } from "../output-serializer/stream-chunk-serializer";

export interface SseDeliveryInput {
  serializedText: string;
  stream: StreamChunkSerializerOutput;
  retryPolicy: DeliveryBuildResult["retryPolicy"];
}

export function sseDelivery(input: SseDeliveryInput): DeliveryBuildResult {
  const streamBody =
    input.stream.text ||
    `event: done\ndata: ${JSON.stringify({ done: true, text: input.serializedText })}\n\n`;

  const text = `retry: ${input.retryPolicy.baseBackoffMs}\n${streamBody}`;

  return {
    channel: "sse",
    format: "plain-text",
    text,
    payload: {
      mode: "sse",
      text: input.serializedText,
      streamChunkCount: input.stream.chunkCount,
      retry: input.retryPolicy.baseBackoffMs,
    },
    retryPolicy: input.retryPolicy,
  };
}
