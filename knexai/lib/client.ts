export type LeticiaMessage = {
  role: "user" | "assistant";
  content: string;
};

type StreamHandlers = {
  signal?: AbortSignal;
  onChunk?: (delta: string) => void;
  onStart?: () => void;
  onDone?: () => void;
};

/**
 * Consumidor de streaming do endpoint /api/knexai.
 * Usa fetch + ReadableStream para ir anexando os deltas.
 */
export async function streamLeticia(prompt: string, history: LeticiaMessage[], handlers: StreamHandlers = {}) {
  const res = await fetch("/api/knexai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, history }),
    signal: handlers.signal,
  });

  if (!res.ok) {
    throw new Error(`LETICIA_HTTP_${res.status}`);
  }
  if (!res.body) {
    throw new Error("LETICIA_STREAM_EMPTY");
  }

  handlers.onStart?.();

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const delta = decoder.decode(value, { stream: true });
    if (delta) handlers.onChunk?.(delta);
  }
  const tail = decoder.decode();
  if (tail) handlers.onChunk?.(tail);

  handlers.onDone?.();
}
