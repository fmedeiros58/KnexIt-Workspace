const PERSISTENT_PREFS_MAP =
  (globalThis as { __assistantPersistentPrefsStore?: Map<string, Record<string, unknown>> }).__assistantPersistentPrefsStore ??
  new Map<string, Record<string, unknown>>();

(globalThis as { __assistantPersistentPrefsStore?: Map<string, Record<string, unknown>> }).__assistantPersistentPrefsStore =
  PERSISTENT_PREFS_MAP;

export class PersistentPrefsStore {
  async get(subjectKey: string) {
    return PERSISTENT_PREFS_MAP.get(subjectKey) || null;
  }

  private resolveKey(ctx: { requestId: string; mode: "chat" | "write"; conversationKey?: string }) {
    const explicit = `${ctx.conversationKey || ""}`.trim();
    if (explicit) {
      return `pref:${ctx.mode}:${explicit.slice(0, 160)}`;
    }
    return `pref:${ctx.mode}:${ctx.requestId}`;
  }

  async load(ctx: { requestId: string; mode: "chat" | "write"; conversationKey?: string }) {
    const key = this.resolveKey(ctx);
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
