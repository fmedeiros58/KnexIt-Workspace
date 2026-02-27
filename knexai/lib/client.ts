export type LeticiaMessage = {
  role: "user" | "assistant";
  content: string;
};

export type PersistedMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

export type PersistedThread = {
  id: string;
  title: string;
  updatedAt: string;
  lastMessageAt: string | null;
  messages: PersistedMessage[];
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

function ensureOk(res: Response, label: string) {
  if (res.ok) return;
  throw new Error(`${label}_HTTP_${res.status}`);
}

export async function loadPersistedThreads(sessionId: string): Promise<PersistedThread[]> {
  const url = `/api/knexai/threads?sessionId=${encodeURIComponent(sessionId)}&includeMessages=1`;
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  ensureOk(res, "KNEXAI_THREADS_GET");
  const payload = (await res.json()) as { threads?: PersistedThread[] };
  return Array.isArray(payload?.threads) ? payload.threads : [];
}

export async function createPersistedThread(sessionId: string, title: string): Promise<PersistedThread> {
  const res = await fetch("/api/knexai/threads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, title }),
  });
  ensureOk(res, "KNEXAI_THREADS_POST");
  const payload = (await res.json()) as { thread?: PersistedThread };
  if (!payload?.thread) throw new Error("KNEXAI_THREADS_POST_INVALID");
  return payload.thread;
}

export async function savePersistedMessage(input: {
  sessionId: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const res = await fetch("/api/knexai/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  ensureOk(res, "KNEXAI_MESSAGES_POST");
}
