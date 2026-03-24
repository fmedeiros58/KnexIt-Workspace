import { NextRequest } from "next/server";

import {
  buildResponseHeadersWithCors,
  enforcePublicApiRequest,
  handlePublicApiPreflight,
  jsonWithCors,
  readJsonBodyWithLimit,
  sanitizePublicErrorMessage,
} from "@/app/api/_shared/public-api";
import { createAssistantPipelineOrchestratorService } from "@/core/assistant/pipeline/pipeline-orchestrator.service";
import { RagPipelineError } from "@/core/rag/rag-errors";
import { createRagQueryService } from "@/core/rag/rag-query-service";
import { toSseStream } from "@/core/rag/streaming-response";
import { logger } from "@/core/utils/logger";

const ragService = createRagQueryService();
const assistantOrchestrator = createAssistantPipelineOrchestratorService(ragService);

const MAX_MESSAGE_CHARS = Number(process.env.PUBLIC_API_MAX_MESSAGE_CHARS || 32000);
const MAX_HISTORY_ITEMS = Number(process.env.PUBLIC_API_MAX_HISTORY_ITEMS || 32);
const MAX_HISTORY_ITEM_CHARS = Number(process.env.PUBLIC_API_MAX_HISTORY_ITEM_CHARS || 12000);
const HISTORY_ITEM_TRUNCATE_SUFFIX = "...";

export type ChatRouteHandlerConfig = {
  routeLabel: string;
  requireApiKey: boolean;
  includeRequestMetaInLog?: boolean;
  includeAnswerCharsInSuccessLog?: boolean;
  includeKnownErrorMessageInLog?: boolean;
  enablePipelineModeOverride?: boolean;
  logEvents: {
    request: string;
    historySanitized: string;
    streamOpen: string;
    success: string;
    knownError: string;
    internalError: string;
  };
  codes: {
    messageRequired: string;
    messageTooLong: string;
    streamMissing: string;
    internalError: string;
  };
};

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseOptionalFiniteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalDistance(value: unknown): number | null | undefined {
  if (value === null) return null;
  return parseOptionalFiniteNumber(value);
}

function parseOptionalPositiveInt(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const rounded = Math.round(parsed);
  return rounded > 0 ? rounded : undefined;
}

function parseOptionalPositiveIntArray(value: unknown, maxItems = 64) {
  if (!Array.isArray(value)) return undefined;
  const normalized: number[] = [];
  const seen = new Set<number>();
  for (const raw of value) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) continue;
    const rounded = Math.round(parsed);
    if (rounded <= 0 || seen.has(rounded)) continue;
    seen.add(rounded);
    normalized.push(rounded);
    if (normalized.length >= maxItems) break;
  }
  return normalized.length ? normalized : undefined;
}

function parseOptionalSeed(value: unknown) {
  if (value === null) return null;
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
}

function parseOptionalBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return undefined;
}

function parsePipelineVersion(value: unknown): "v1" | "v2" | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "v1" || normalized === "v2") return normalized;
  return undefined;
}

function parseOptionalEngineMode(value: unknown): "direct" | "anm" | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "direct" || normalized === "anm") return normalized;
  return undefined;
}

function parseStreamMode(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase();
  if (normalized === "sse" || normalized === "plain") return normalized;
  return "";
}

function parseOptionalLanguageId(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 32);
}

function parseConversationKey(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 160);
}

function parsePipelineModeOverride(value: unknown): "auto" | "lite" | "full" | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "auto" || normalized === "lite" || normalized === "full") return normalized;
  return undefined;
}

function isStrictShortResponsePrompt(prompt: string) {
  const normalized = `${prompt || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;
  if (/\b(token de validacao|token exato)\b/.test(normalized)) return true;
  if (/\b(responda apenas|responda somente|apenas com|somente com)\b/.test(normalized)) return true;
  if (/\b(uma frase|1 frase|uma palavra|1 palavra|sim ou nao|so o nome|somente o nome)\b/.test(normalized)) return true;
  return false;
}

function resolveAutoScopedRagMaxResponseTokens(input: {
  prompt: string;
  hasDocumentScope: boolean;
  requestedMaxResponseTokens?: number;
}) {
  if (typeof input.requestedMaxResponseTokens === "number" && input.requestedMaxResponseTokens > 0) {
    return input.requestedMaxResponseTokens;
  }
  if (!input.hasDocumentScope) return input.requestedMaxResponseTokens;
  if (!isStrictShortResponsePrompt(input.prompt)) return input.requestedMaxResponseTokens;
  if (input.prompt.length <= 80) return 128;
  return 192;
}

function buildAttachmentsFromComposer(
  composerAttachmentIds: number[] | undefined,
  scopedDocumentIds: number[] | undefined,
) {
  const ids = (composerAttachmentIds && composerAttachmentIds.length ? composerAttachmentIds : scopedDocumentIds) || [];
  return ids.map((id) => ({ id: `${id}`, kind: "file" as const, name: `documento-${id}` }));
}

function truncateHistoryContent(value: string) {
  if (value.length <= MAX_HISTORY_ITEM_CHARS) return value;
  const maxBaseLength = Math.max(64, MAX_HISTORY_ITEM_CHARS - HISTORY_ITEM_TRUNCATE_SUFFIX.length);
  return `${value.slice(0, maxBaseLength).trimEnd()}${HISTORY_ITEM_TRUNCATE_SUFFIX}`;
}

function normalizeHistory(value: unknown) {
  if (!Array.isArray(value)) {
    return {
      items: [] as Array<{ role: "user" | "assistant"; content: string }>,
      droppedCount: 0,
      truncatedCount: 0,
    };
  }

  const droppedCount = Math.max(0, value.length - MAX_HISTORY_ITEMS);
  const source = droppedCount > 0 ? value.slice(-MAX_HISTORY_ITEMS) : value;
  const normalized: Array<{ role: "user" | "assistant"; content: string }> = [];
  let truncatedCount = 0;

  for (const row of source) {
    if (!row || typeof row !== "object") continue;
    const role = (row as { role?: unknown }).role;
    if (role !== "user" && role !== "assistant") continue;
    const content = normalizeString((row as { content?: unknown }).content);
    if (!content) continue;
    const trimmed = truncateHistoryContent(content);
    if (trimmed.length < content.length) truncatedCount += 1;
    normalized.push({ role, content: trimmed });
  }

  return {
    items: normalized,
    droppedCount,
    truncatedCount,
  };
}

export function createChatRouteHandlers(config: ChatRouteHandlerConfig) {
  const routeOptions = {
    methods: ["POST"] as const,
    requireApiKey: config.requireApiKey,
  } as const;

  async function OPTIONS(req: NextRequest) {
    return handlePublicApiPreflight(req, routeOptions);
  }

  async function POST(req: NextRequest) {
    const { context, response } = enforcePublicApiRequest(req, routeOptions);
    if (response) return response;

    if (config.includeRequestMetaInLog) {
      logger.info(config.logEvents.request, {
        requestId: context.requestId,
        method: context.method,
        path: context.path,
        clientIp: context.clientIp,
      });
    } else {
      logger.info(config.logEvents.request, {
        requestId: context.requestId,
        path: context.path,
      });
    }

    try {
      const parsed = await readJsonBodyWithLimit(req, context, { methods: routeOptions.methods });
      if (parsed.response) return parsed.response;
      const body = parsed.body || {};
      const message = normalizeString(body?.message) || normalizeString(body?.question) || normalizeString(body?.prompt);
      if (!message) {
        throw new RagPipelineError(
          400,
          config.codes.messageRequired,
          `Envie message (ou question/prompt) para executar ${config.routeLabel}.`,
        );
      }

      if (message.length > MAX_MESSAGE_CHARS) {
        throw new RagPipelineError(
          400,
          config.codes.messageTooLong,
          `message excede limite maximo (${MAX_MESSAGE_CHARS} caracteres).`,
        );
      }

      const normalizedHistory = normalizeHistory(body?.history);
      if (normalizedHistory.droppedCount > 0 || normalizedHistory.truncatedCount > 0) {
        logger.warn(config.logEvents.historySanitized, {
          requestId: context.requestId,
          droppedItems: normalizedHistory.droppedCount,
          truncatedItems: normalizedHistory.truncatedCount,
          maxItems: MAX_HISTORY_ITEMS,
          maxItemChars: MAX_HISTORY_ITEM_CHARS,
        });
      }

      const history = normalizedHistory.items;
      const conversationKey =
        parseConversationKey(body?.conversationKey) ||
        parseConversationKey(body?.threadId) ||
        parseConversationKey(body?.sessionId);
      const composerBound = parseOptionalBoolean(body?.composerBound);
      const composerAttachmentIds = parseOptionalPositiveIntArray(body?.composerAttachmentIds);
      const topK = parseOptionalPositiveInt(body?.topK);
      const maxDistance = parseOptionalDistance(body?.maxDistance);
      const documentId = parseOptionalPositiveInt(body?.documentId);
      const documentIds = parseOptionalPositiveIntArray(body?.documentIds);
      const sourceType = normalizeString(body?.sourceType) || undefined;
      const retrievalEmbeddingModel = normalizeString(body?.retrievalEmbeddingModel) || undefined;
      const preferredResponseLanguageId = parseOptionalLanguageId(body?.preferredResponseLanguageId);
      const pipelineModeOverride = config.enablePipelineModeOverride
        ? parsePipelineModeOverride(body?.pipelineMode)
        : undefined;
      const maxResponseTokens = parseOptionalPositiveInt(body?.maxResponseTokens);
      const temperature = parseOptionalFiniteNumber(body?.temperature);
      const seed = parseOptionalSeed(body?.seed);
      const pipelineVersion = parsePipelineVersion(body?.pipeline) || parsePipelineVersion(req.headers.get("x-pipeline"));
      const anmEngineMode = parseOptionalEngineMode(body?.anmEngineMode ?? body?.engineMode);
      const anmBaseUrl = normalizeString(body?.anmBaseUrl);
      const anmTimeoutMs = parseOptionalPositiveInt(body?.anmTimeoutMs);
      const anmSoftTimeoutMs = parseOptionalPositiveInt(body?.anmSoftTimeoutMs);
      const anmFallbackToDirect = parseOptionalBoolean(body?.anmFallbackToDirect);
      const wantsStream = parseOptionalBoolean(body?.stream) === true;
      const requestedStreamMode = parseStreamMode(body?.streamMode);
      const acceptHeader = `${req.headers.get("accept") || ""}`.toLowerCase();
      const streamMode = requestedStreamMode || (acceptHeader.includes("text/event-stream") ? "sse" : "plain");
      const hasDocumentScope =
        composerBound === true ||
        Boolean(documentId) ||
        Boolean(documentIds?.length) ||
        Boolean(composerAttachmentIds?.length);
      const effectiveMaxResponseTokens = resolveAutoScopedRagMaxResponseTokens({
        prompt: message,
        hasDocumentScope,
        requestedMaxResponseTokens: maxResponseTokens,
      });

      if (wantsStream) {
        const run = await assistantOrchestrator.run({
          requestId: context.requestId,
          conversationKey,
          mode: "chat",
          stream: true,
          message,
          conversation: history,
          attachments: buildAttachmentsFromComposer(composerAttachmentIds, documentIds),
          ragInput: {
            pipelineVersion,
            composerBound,
            composerAttachmentIds,
            topK,
            maxDistance,
            documentId,
            documentIds,
            sourceType,
            retrievalEmbeddingModel,
            pipelineModeOverride,
            preferredResponseLanguageId,
            maxResponseTokens: effectiveMaxResponseTokens,
            temperature,
            seed,
            anmEngineMode,
            anmBaseUrl: anmBaseUrl || undefined,
            anmTimeoutMs,
            anmSoftTimeoutMs,
            anmFallbackToDirect,
          },
        });
        const plainStream = run.stream;
        if (!plainStream) {
          throw new RagPipelineError(
            500,
            config.codes.streamMissing,
            "Falha ao abrir stream do assistant pipeline.",
          );
        }
        const responseStream = streamMode === "sse" ? toSseStream(plainStream) : plainStream;
        logger.info(config.logEvents.streamOpen, {
          requestId: context.requestId,
          path: context.path,
          streamMode,
        });
        const headers = buildResponseHeadersWithCors(context, { methods: routeOptions.methods }, {
          "Content-Type": streamMode === "sse" ? "text/event-stream; charset=utf-8" : "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
        return new Response(responseStream, { status: 200, headers });
      }

      const run = await assistantOrchestrator.run({
        requestId: context.requestId,
        conversationKey,
        mode: "chat",
        stream: false,
        message,
        conversation: history,
        attachments: buildAttachmentsFromComposer(composerAttachmentIds, documentIds),
        ragInput: {
          pipelineVersion,
          composerBound,
          composerAttachmentIds,
          topK,
          maxDistance,
          documentId,
          documentIds,
          sourceType,
          retrievalEmbeddingModel,
          pipelineModeOverride,
          preferredResponseLanguageId,
          maxResponseTokens: effectiveMaxResponseTokens,
          temperature,
          seed,
          anmEngineMode,
          anmBaseUrl: anmBaseUrl || undefined,
          anmTimeoutMs,
          anmSoftTimeoutMs,
          anmFallbackToDirect,
        },
      });
      const content = `${run.content || ""}`.trim();
      const metadata = run.ragMetadata || null;
      logger.info(config.logEvents.success, {
        requestId: context.requestId,
        ...(config.includeAnswerCharsInSuccessLog ? { answerChars: content.length } : {}),
        totalMs: metadata?.timingsMs?.total ?? null,
        retrievedChunks: metadata?.retrieval?.returnedChunks ?? null,
      });

      return jsonWithCors(
        context,
        {
          ok: true,
          reply: {
            role: "assistant",
            content,
          },
          metadata,
          meta: run.meta,
        },
        200,
        { methods: routeOptions.methods },
      );
    } catch (error) {
      if (error instanceof RagPipelineError) {
        logger.warn(config.logEvents.knownError, {
          requestId: context.requestId,
          code: error.code,
          status: error.status,
          ...(config.includeKnownErrorMessageInLog ? { message: error.message } : {}),
        });
        const safeMessage =
          error.status >= 500
            ? sanitizePublicErrorMessage(error.message, `Falha interna ao executar ${config.routeLabel}.`)
            : error.message;
        return jsonWithCors(
          context,
          { ok: false, code: error.code, message: safeMessage, details: error.details ?? null },
          error.status,
          { methods: routeOptions.methods },
        );
      }

      const message = error instanceof Error ? error.message : `Falha interna ao executar ${config.routeLabel}.`;
      logger.error(config.logEvents.internalError, { requestId: context.requestId });
      return jsonWithCors(
        context,
        {
          ok: false,
          code: config.codes.internalError,
          message: sanitizePublicErrorMessage(message, `Falha interna ao executar ${config.routeLabel}.`),
        },
        500,
        { methods: routeOptions.methods },
      );
    }
  }

  return { OPTIONS, POST };
}
