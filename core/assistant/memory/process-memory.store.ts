const PROCESS_MEMORY_MAP =
  (globalThis as { __assistantProcessMemoryStore?: Map<string, Record<string, unknown>> }).__assistantProcessMemoryStore ??
  new Map<string, Record<string, unknown>>();

(globalThis as { __assistantProcessMemoryStore?: Map<string, Record<string, unknown>> }).__assistantProcessMemoryStore =
  PROCESS_MEMORY_MAP;

export class ProcessMemoryStore {
  async get(conversationKey: string) {
    return PROCESS_MEMORY_MAP.get(conversationKey) || null;
  }

  async load(ctx: { requestId: string; mode: "chat" | "write"; userMessage: string }) {
    const normalized = `${ctx.userMessage || ""}`.trim();
    const key = normalized ? `conv:${ctx.mode}:${normalized.slice(0, 120)}` : `conv:${ctx.requestId}`;
    const current = await this.get(key);
    if (current) return current;
    const bootstrap = {
      project: {
        title: "Current session",
        goal: "Keep continuity and preserve scope",
      },
      decisions: [],
      outline: [],
    } as Record<string, unknown>;
    await this.upsert(key, bootstrap);
    return bootstrap;
  }

  async upsert(conversationKey: string, state: Record<string, unknown>) {
    PROCESS_MEMORY_MAP.set(conversationKey, state);
  }
}
