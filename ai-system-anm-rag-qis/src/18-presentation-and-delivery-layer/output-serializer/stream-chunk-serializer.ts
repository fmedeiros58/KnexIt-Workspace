import type { StreamChunk } from "../presentation-contracts";

export interface StreamChunkSerializerInput {
  chunks: StreamChunk[];
  mode?: "plain" | "sse" | "websocket";
}

export interface StreamChunkSerializerOutput {
  ok: boolean;
  component: string;
  score: number;
  text: string;
  chunkCount: number;
}

function toSseChunk(chunk: StreamChunk): string {
  const payload = JSON.stringify({
    index: chunk.index,
    delta: chunk.delta,
    done: chunk.done,
  });
  return `event: chunk\ndata: ${payload}\n\n`;
}

function toWebsocketChunk(chunk: StreamChunk): string {
  return JSON.stringify({ type: "chunk", index: chunk.index, delta: chunk.delta, done: chunk.done });
}

export function streamChunkSerializer(input: StreamChunkSerializerInput): StreamChunkSerializerOutput {
  const mode = input.mode || "plain";
  const chunks = input.chunks || [];
  const lines: string[] = [];

  for (const chunk of chunks) {
    if (mode === "sse") lines.push(toSseChunk(chunk));
    else if (mode === "websocket") lines.push(toWebsocketChunk(chunk));
    else lines.push(chunk.delta);
  }

  const text = mode === "plain" ? lines.join("") : lines.join("\n");

  return {
    ok: true,
    component: "stream-chunk-serializer",
    score: chunks.length > 0 ? 0.9 : 0.35,
    text,
    chunkCount: chunks.length,
  };
}
