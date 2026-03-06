const PERSISTENT_PREFS_MAP =
  (globalThis as { __assistantPersistentPrefsStore?: Map<string, Record<string, unknown>> }).__assistantPersistentPrefsStore ??
  new Map<string, Record<string, unknown>>();

(globalThis as { __assistantPersistentPrefsStore?: Map<string, Record<string, unknown>> }).__assistantPersistentPrefsStore =
  PERSISTENT_PREFS_MAP;

export class PersistentPrefsStore {
  async get(subjectKey: string) {
    return PERSISTENT_PREFS_MAP.get(subjectKey) || null;
  }

  async load(ctx: { requestId: string; mode: "chat" | "write"; userMessage: string }) {
    const normalized = `${ctx.userMessage || ""}`.trim();
    const key = normalized ? `pref:${ctx.mode}:${normalized.slice(0, 120)}` : `pref:${ctx.requestId}`;
    const current = await this.get(key);
    if (current) return current;
    const bootstrap = {
      progressHeader: true,
    } as Record<string, unknown>;
    await this.upsert(key, bootstrap);
    return bootstrap;
  }

  async upsert(subjectKey: string, prefs: Record<string, unknown>) {
    PERSISTENT_PREFS_MAP.set(subjectKey, prefs);
  }
}
