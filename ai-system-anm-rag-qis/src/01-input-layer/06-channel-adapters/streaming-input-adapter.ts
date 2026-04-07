export interface StreamingInputAdapterInput {
  chunks: string[];
}

export interface StreamingInputAdapterOutput {
  message: string;
  channel: "streaming";
  chunkCount: number;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function streamingInputAdapter(input: StreamingInputAdapterInput): StreamingInputAdapterOutput {
  const message = (input.chunks || []).join("").trim();
  const chunkCount = input.chunks?.length || 0;
  return {
    message,
    channel: "streaming",
    chunkCount,
    ok: true,
    component: "streaming-input-adapter",
    score: chunkCount > 0 ? 0.8 : 0.2,
    detail: message,
    context: {
      chunkCount,
    },
  };
}
