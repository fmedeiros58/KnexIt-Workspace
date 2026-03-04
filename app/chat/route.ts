import { NextRequest } from "next/server";

import {
  buildResponseHeadersWithCors,
  enforcePublicApiRequest,
  handlePublicApiPreflight,
  jsonWithCors,
  readJsonBodyWithLimit,
  sanitizePublicErrorMessage,
} from "@/app/api/_shared/public-api";
import { RagPipelineError } from "@/core/rag/rag-errors";
import { createRagQueryService } from "@/core/rag/rag-query-service";
import { toSseStream } from "@/core/rag/streaming-response";
import { logger } from "@/core/utils/logger";

export const runtime = "nodejs";

const ragService = createRagQueryService();
const ROUTE_OPTIONS = { methods: ["POST"], requireApiKey: true } as const;
const MAX_MESSAGE_CHARS = Number(process.env.PUBLIC_API_MAX_MESSAGE_CHARS || 32000);
const MAX_HISTORY_ITEMS = Number(process.env.PUBLIC_API_MAX_HISTORY_ITEMS || 20);
const MAX_HISTORY_ITEM_CHARS = Number(process.env.PUBLIC_API_MAX_HISTORY_ITEM_CHARS || 12000);
const HISTORY_ITEM_TRUNCATE_SUFFIX = "...";

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

function parseStreamMode(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase();
  if (normalized === "sse" || normalized === "plain") return normalized;
  return "";
}

export async function OPTIONS(req: NextRequest) {
  return handlePublicApiPreflight(req, ROUTE_OPTIONS);
}

export async function POST(req: NextRequest) {
  const { context, response } = enforcePublicApiRequest(req, ROUTE_OPTIONS);
  if (response) return response;
  logger.info("PUBLIC_CHAT_REQUEST", {
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    clientIp: context.clientIp,
  });

  try {
    const parsed = await readJsonBodyWithLimit(req, context, { methods: ROUTE_OPTIONS.methods });
    if (parsed.response) return parsed.response;
    const body = parsed.body || {};
    const message = normalizeString(body?.message) || normalizeString(body?.question) || normalizeString(body?.prompt);
    if (!message) {
      throw new RagPipelineError(400, "RAG_MESSAGE_REQUIRED", "Envie message (ou question/prompt) para executar /chat.");
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      throw new RagPipelineError(
        400,
        "PUBLIC_CHAT_MESSAGE_TOO_LONG",
        `message excede limite maximo (${MAX_MESSAGE_CHARS} caracteres).`,
      );
    }

    const normalizedHistory = normalizeHistory(body?.history);
    if (normalizedHistory.droppedCount > 0 || normalizedHistory.truncatedCount > 0) {
      logger.warn("PUBLIC_CHAT_HISTORY_SANITIZED", {
        requestId: context.requestId,
        droppedItems: normalizedHistory.droppedCount,
        truncatedItems: normalizedHistory.truncatedCount,
        maxItems: MAX_HISTORY_ITEMS,
        maxItemChars: MAX_HISTORY_ITEM_CHARS,
      });
    }
    const history = normalizedHistory.items;
    const wantsStream = parseOptionalBoolean(body?.stream) === true;
    const requestedStreamMode = parseStreamMode(body?.streamMode);
    const acceptHeader = `${req.headers.get("accept") || ""}`.toLowerCase();
    const streamMode = requestedStreamMode || (acceptHeader.includes("text/event-stream") ? "sse" : "plain");
    if (wantsStream) {
      const plainStream = await ragService.queryStream({
        question: message,
        history,
        requestId: context.requestId,
        topK: parseOptionalPositiveInt(body?.topK),
        maxDistance: parseOptionalDistance(body?.maxDistance),
        documentId: parseOptionalPositiveInt(body?.documentId),
        documentIds: parseOptionalPositiveIntArray(body?.documentIds),
        sourceType: normalizeString(body?.sourceType) || undefined,
        retrievalEmbeddingModel: normalizeString(body?.retrievalEmbeddingModel) || undefined,
        maxResponseTokens: parseOptionalPositiveInt(body?.maxResponseTokens),
        temperature: parseOptionalFiniteNumber(body?.temperature),
        seed: parseOptionalSeed(body?.seed),
      });
      const responseStream = streamMode === "sse" ? toSseStream(plainStream) : plainStream;
      logger.info("PUBLIC_CHAT_STREAM_OPEN", {
        requestId: context.requestId,
        path: context.path,
        streamMode,
      });
      const headers = buildResponseHeadersWithCors(context, { methods: ROUTE_OPTIONS.methods }, {
        "Content-Type": streamMode === "sse" ? "text/event-stream; charset=utf-8" : "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      return new Response(responseStream, { status: 200, headers });
    }

    const result = await ragService.query({
      question: message,
      history,
      requestId: context.requestId,
      topK: parseOptionalPositiveInt(body?.topK),
      maxDistance: parseOptionalDistance(body?.maxDistance),
      documentId: parseOptionalPositiveInt(body?.documentId),
      documentIds: parseOptionalPositiveIntArray(body?.documentIds),
      sourceType: normalizeString(body?.sourceType) || undefined,
      retrievalEmbeddingModel: normalizeString(body?.retrievalEmbeddingModel) || undefined,
      maxResponseTokens: parseOptionalPositiveInt(body?.maxResponseTokens),
      temperature: parseOptionalFiniteNumber(body?.temperature),
      seed: parseOptionalSeed(body?.seed),
    });
    logger.info("PUBLIC_CHAT_SUCCESS", {
      requestId: context.requestId,
      answerChars: result.answer.length,
      totalMs: result.metadata.timingsMs.total,
      retrievedChunks: result.metadata.retrieval.returnedChunks,
    });

    return jsonWithCors(
      context,
      {
        ok: true,
        reply: {
          role: "assistant",
          content: result.answer,
        },
        metadata: result.metadata,
      },
      200,
      { methods: ROUTE_OPTIONS.methods },
    );
  } catch (error) {
    if (error instanceof RagPipelineError) {
      logger.warn("PUBLIC_CHAT_ERROR", {
        requestId: context.requestId,
        code: error.code,
        status: error.status,
      });
      const safeMessage =
        error.status >= 500
          ? sanitizePublicErrorMessage(error.message, "Falha interna ao executar /chat.")
          : error.message;
      return jsonWithCors(
        context,
        { ok: false, code: error.code, message: safeMessage, details: error.details ?? null },
        error.status,
        { methods: ROUTE_OPTIONS.methods },
      );
    }

    const message = error instanceof Error ? error.message : "Falha interna ao executar /chat.";
    logger.error("PUBLIC_CHAT_INTERNAL_ERROR", { requestId: context.requestId });
    return jsonWithCors(
      context,
      {
        ok: false,
        code: "RAG_CHAT_INTERNAL_ERROR",
        message: sanitizePublicErrorMessage(message, "Falha interna ao executar /chat."),
      },
      500,
      { methods: ROUTE_OPTIONS.methods },
    );
  }
}
