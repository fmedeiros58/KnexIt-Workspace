import { PersistentPrefsStore } from "@/core/assistant/memory/persistent-prefs.store";
import { ProcessMemoryStore } from "@/core/assistant/memory/process-memory.store";
import { ShortTermContextProvider } from "@/core/assistant/memory/short-term-context.provider";
import type { PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import type { Stage } from "@/core/assistant/pipeline/stages/stage.interface";

export class MemoryStage implements Stage {
  constructor(
    private readonly shortTerm = new ShortTermContextProvider(),
    private readonly processStore = new ProcessMemoryStore(),
    private readonly prefsStore = new PersistentPrefsStore(),
  ) {}

  async run(ctx: PipelineContext) {
    ctx.progress.stage = "memory";
    ctx.conversation = this.shortTerm.selectRelevantWindow(ctx.conversation, ctx.userMessage, 8);
    ctx.processState = await this.processStore.load({
      requestId: ctx.requestId,
      mode: ctx.mode,
      userMessage: ctx.userMessage,
    });
    ctx.persistentPrefs = await this.prefsStore.load({
      requestId: ctx.requestId,
      mode: ctx.mode,
      userMessage: ctx.userMessage,
    });
    ctx.progress.loadedState = true;

    const updatedState = {
      ...(ctx.processState || {}),
      lastIntent: ctx.intent?.type || "general",
      lastMode: ctx.mode,
      lastMessage: ctx.userMessage.slice(0, 360),
      lastUpdatedAt: Date.now(),
    };
    const memoryKey = `conv:${ctx.mode}:${ctx.userMessage.slice(0, 120)}`;
    await this.processStore.upsert(memoryKey, updatedState);
    ctx.processState = updatedState;
    ctx.progress.updatedState = true;
  }
}
