const PROCESS_MEMORY_MAP =
  (globalThis as { __assistantProcessMemoryStore?: Map<string, Record<string, unknown>> }).__assistantProcessMemoryStore ??
  new Map<string, Record<string, unknown>>();

(globalThis as { __assistantProcessMemoryStore?: Map<string, Record<string, unknown>> }).__assistantProcessMemoryStore =
  PROCESS_MEMORY_MAP;

export class ProcessMemoryStore {
  async get(conversationKey: string) {
    return PROCESS_MEMORY_MAP.get(conversationKey) || null;
  }

  private resolveKey(ctx: { requestId: string; mode: "chat" | "write"; conversationKey?: string }) {
    const explicit = `${ctx.conversationKey || ""}`.trim();
    if (explicit) {
      return `conv:${ctx.mode}:${explicit.slice(0, 160)}`;
    }
    return `conv:${ctx.mode}:${ctx.requestId}`;
  }

  async load(ctx: { requestId: string; mode: "chat" | "write"; conversationKey?: string }) {
    const key = this.resolveKey(ctx);
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
