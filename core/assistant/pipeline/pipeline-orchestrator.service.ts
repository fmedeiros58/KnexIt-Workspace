import { createDefaultProgressSignals } from "@/core/assistant/progress/progress-signals";
import type { ProgressSignals } from "@/core/assistant/progress/progress-signals";
import type { ConversationMessage, PipelineAttachment, PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import { IngestStage } from "@/core/assistant/pipeline/stages/ingest.stage";
import { LanguageStage } from "@/core/assistant/pipeline/stages/language.stage";
import { IntentStage } from "@/core/assistant/pipeline/stages/intent.stage";
import { GenreStage } from "@/core/assistant/pipeline/stages/genre.stage";
import { RetrievalStage } from "@/core/assistant/pipeline/stages/retrieval.stage";
import { MemoryStage } from "@/core/assistant/pipeline/stages/memory.stage";
import { PlanStage } from "@/core/assistant/pipeline/stages/plan.stage";
import { ComposeStage } from "@/core/assistant/pipeline/stages/compose.stage";
import { PostprocessStage } from "@/core/assistant/pipeline/stages/postprocess.stage";
import { LanguageGuardStage } from "@/core/assistant/pipeline/stages/language-guard.stage";
import type { RagQueryInput, RagQueryResult, RagQueryService } from "@/core/rag/rag-query-service";
import { ProgressHeaderInterceptor } from "@/core/assistant/interceptors/progress-header.interceptor";
import type { ProgressHeaderMode, ProgressHeaderStyle, ProgressHeaderTarget } from "@/core/assistant/progress/progress-header.mode";

export type AssistantPipelineRunInput = {
  requestId?: string;
  conversationKey?: string;
  mode?: "chat" | "write";
  stream?: boolean;
  message: string;
  conversation?: ConversationMessage[];
  attachments?: PipelineAttachment[];
  ragInput?: Omit<RagQueryInput, "question" | "history" | "requestId">;
  headerMode?: ProgressHeaderMode;
  headerStyle?: ProgressHeaderStyle;
  headerTarget?: ProgressHeaderTarget;
};

export type AssistantPipelineRunResult = {
  content: string;
  stream: ReadableStream<Uint8Array> | null;
  ragMetadata: RagQueryResult["metadata"] | null;
  meta: {
    requestId: string;
    progress: ProgressSignals;
    intent: PipelineContext["intent"] | null;
    genre: PipelineContext["genre"] | null;
    genreConfidence: number | null;
    templateId: string | null;
    plan: PipelineContext["plan"] | null;
    language: PipelineContext["language"] | null;
    qualityGate: PipelineContext["qualityGate"] | null;
  };
};

function safeRandomId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `assistant-${Date.now()}`;
  }
}

function resolveConversationKey(input: AssistantPipelineRunInput, requestId: string) {
  const raw = `${input.conversationKey || ""}`.trim();
  if (!raw) return `assistant:${requestId}`;
  return raw.slice(0, 160);
}

function parseOptionalBoolean(value: string | undefined) {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

export class PipelineOrchestratorService {
  private readonly headerInterceptor = new ProgressHeaderInterceptor();

  constructor(
    private readonly ingest: IngestStage,
    private readonly language: LanguageStage,
    private readonly intent: IntentStage,
    private readonly genre: GenreStage,
    private readonly retrieval: RetrievalStage,
    private readonly memory: MemoryStage,
    private readonly plan: PlanStage,
    private readonly compose: ComposeStage,
    private readonly post: PostprocessStage,
    private readonly languageGuard: LanguageGuardStage,
  ) {}

  async run(input: AssistantPipelineRunInput): Promise<AssistantPipelineRunResult> {
    const resolvedRequestId = input.requestId || safeRandomId();
    const ctx: PipelineContext = {
      requestId: resolvedRequestId,
      conversationKey: resolveConversationKey(input, resolvedRequestId),
      mode: input.mode || "chat",
      stream: input.stream === true,
      userMessage: `${input.message || ""}`.trim(),
      conversation: Array.isArray(input.conversation) ? input.conversation : [],
      attachments: Array.isArray(input.attachments) ? input.attachments : [],
      constraints: [],
      intent: undefined,
      evidence: [],
      processState: null,
      persistentPrefs: null,
      progress: createDefaultProgressSignals(),
      ragInput: input.ragInput || {},
    };

    await this.ingest.run(ctx);
    await this.language.run(ctx);
    await this.intent.run(ctx);
    await this.genre.run(ctx);
    await this.retrieval.run(ctx);
    await this.memory.run(ctx);
    await this.plan.run(ctx);
    await this.compose.run(ctx);
    await this.post.run(ctx);
    await this.languageGuard.run(ctx);
    ctx.progress.stage = "done";
    const genreConfidence = typeof ctx.genreConfidence === "number" ? ctx.genreConfidence : null;

    if (ctx.stream && ctx.finalStream) {
      const shouldPrefixStreamHeader = parseOptionalBoolean(process.env.ASSISTANT_PROGRESS_HEADER_STREAM_PREFIX) === true;
      const decoratedStream = shouldPrefixStreamHeader
        ? this.headerInterceptor.applyToPlainStream(ctx.finalStream, {
            responseMode: ctx.mode,
            progress: ctx.progress,
            language: ctx.language || undefined,
            requestId: ctx.requestId,
            mode: input.headerMode,
            style: input.headerStyle,
            target: input.headerTarget,
          })
        : ctx.finalStream;
      return {
        content: "",
        stream: decoratedStream,
        ragMetadata: ctx.ragMetadata || null,
        meta: {
          requestId: ctx.requestId,
          progress: ctx.progress,
          intent: ctx.intent || null,
          genre: ctx.genre || null,
          genreConfidence,
          templateId: ctx.templateSpec?.id || null,
          plan: ctx.plan || null,
          language: ctx.language || null,
          qualityGate: ctx.qualityGate || null,
        },
      };
    }

    const content = this.headerInterceptor.applyToContent(ctx.finalAnswer || ctx.draftAnswer || "", {
      responseMode: ctx.mode,
      progress: ctx.progress,
      language: ctx.language || undefined,
      requestId: ctx.requestId,
      mode: input.headerMode,
      style: input.headerStyle,
      target: input.headerTarget,
    });
    return {
      content,
      stream: null,
      ragMetadata: ctx.ragMetadata || null,
      meta: {
        requestId: ctx.requestId,
        progress: ctx.progress,
        intent: ctx.intent || null,
        genre: ctx.genre || null,
        genreConfidence,
        templateId: ctx.templateSpec?.id || null,
        plan: ctx.plan || null,
        language: ctx.language || null,
        qualityGate: ctx.qualityGate || null,
      },
    };
  }
}

export function createAssistantPipelineOrchestratorService(ragService: RagQueryService) {
  return new PipelineOrchestratorService(
    new IngestStage(),
    new LanguageStage(),
    new IntentStage(),
    new GenreStage(),
    new RetrievalStage(),
    new MemoryStage(),
    new PlanStage(),
    new ComposeStage(ragService),
    new PostprocessStage(ragService),
    new LanguageGuardStage(ragService),
  );
}
