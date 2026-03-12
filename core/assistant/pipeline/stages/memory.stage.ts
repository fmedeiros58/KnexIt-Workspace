import { PersistentPrefsStore } from "@/core/assistant/memory/persistent-prefs.store";
import { ProcessMemoryStore } from "@/core/assistant/memory/process-memory.store";
import { ShortTermContextProvider } from "@/core/assistant/memory/short-term-context.provider";
import type { PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import type { Stage } from "@/core/assistant/pipeline/stages/stage.interface";
import {
  buildConversationStateSummaryBlock,
  rebuildConversationState,
} from "@/core/chat/perception/conversation-state.manager";
import type { ConversationChatHistoryItem } from "@/core/chat/perception/types";

function toConversationPerceptionHistory(conversation: PipelineContext["conversation"]): ConversationChatHistoryItem[] {
  return (conversation || [])
    .filter(
      (row): row is { role: "user" | "assistant"; content: string } => row.role === "user" || row.role === "assistant",
    )
    .map((row) => ({
      role: row.role,
      content: `${row.content || ""}`.trim(),
    }))
    .filter((row) => row.content.length > 0);
}

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
      conversationKey: ctx.conversationKey,
    });
    ctx.persistentPrefs = await this.prefsStore.load({
      requestId: ctx.requestId,
      mode: ctx.mode,
      conversationKey: ctx.conversationKey,
    });
    ctx.progress.loadedState = true;

    const conversationState = rebuildConversationState({
      conversationKey: ctx.conversationKey,
      prompt: ctx.userMessage,
      history: toConversationPerceptionHistory(ctx.conversation),
      localeHint: ctx.language?.tag,
    });
    const conversationStateSummary = buildConversationStateSummaryBlock(conversationState);
    const updatedState = {
      ...(ctx.processState || {}),
      lastIntent: ctx.intent?.type || "general",
      lastMode: ctx.mode,
      lastMessage: ctx.userMessage.slice(0, 360),
      lastUpdatedAt: Date.now(),
      conversation_state: conversationState,
      conversation_state_summary: conversationStateSummary,
    };
    const memoryKey = `conv:${ctx.mode}:${ctx.conversationKey.slice(0, 160)}`;
    await this.processStore.upsert(memoryKey, updatedState);
    ctx.processState = updatedState;
    ctx.progress.updatedState = true;
  }
}
