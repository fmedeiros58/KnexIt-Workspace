import { NextRequest } from "next/server";

import {
  enforcePublicApiRequest,
  handlePublicApiPreflight,
  jsonWithCors,
  readJsonBodyWithLimit,
  sanitizePublicErrorMessage,
} from "@/app/api/_shared/public-api";
import { createRagQueryService } from "@/core/rag/rag-query-service";
import { RagPipelineError } from "@/core/rag/rag-errors";
import { logger } from "@/core/utils/logger";

export const runtime = "nodejs";

const ragService = createRagQueryService();
const ROUTE_OPTIONS = { methods: ["POST"], requireApiKey: true } as const;
const MAX_MESSAGE_CHARS = Number(process.env.PUBLIC_API_MAX_MESSAGE_CHARS || 4000);
const MAX_HISTORY_ITEMS = Number(process.env.PUBLIC_API_MAX_HISTORY_ITEMS || 20);
const MAX_HISTORY_ITEM_CHARS = Number(process.env.PUBLIC_API_MAX_HISTORY_ITEM_CHARS || 3000);

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

function parseOptionalSeed(value: unknown) {
  if (value === null) return null;
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
}

function normalizeHistory(value: unknown) {
  if (!Array.isArray(value)) return [];
  if (value.length > MAX_HISTORY_ITEMS) {
    throw new RagPipelineError(
      400,
      "RAG_CHAT_HISTORY_TOO_LONG",
      `history excede limite maximo (${MAX_HISTORY_ITEMS} itens).`,
    );
  }
  const normalized: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const role = (row as { role?: unknown }).role;
    if (role !== "user" && role !== "assistant") continue;
    const content = normalizeString((row as { content?: unknown }).content);
    if (!content) continue;
    if (content.length > MAX_HISTORY_ITEM_CHARS) {
      throw new RagPipelineError(
        400,
        "RAG_CHAT_HISTORY_ITEM_TOO_LONG",
        `Item de history excede limite (${MAX_HISTORY_ITEM_CHARS} caracteres).`,
      );
    }
    normalized.push({ role, content });
  }
  return normalized;
}

export async function POST(req: NextRequest) {
  const { context, response } = enforcePublicApiRequest(req, ROUTE_OPTIONS);
  if (response) return response;
  logger.info("RAG_CHAT_API_REQUEST", { requestId: context.requestId, path: context.path });

  try {
    const parsed = await readJsonBodyWithLimit(req, context, { methods: ROUTE_OPTIONS.methods });
    if (parsed.response) return parsed.response;
    const body = parsed.body || {};
    const message = normalizeString(body?.message) || normalizeString(body?.question) || normalizeString(body?.prompt);
    if (!message) {
      throw new RagPipelineError(400, "RAG_MESSAGE_REQUIRED", "Envie message (ou question/prompt) para executar /api/chat.");
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      throw new RagPipelineError(
        400,
        "RAG_CHAT_MESSAGE_TOO_LONG",
        `message excede limite maximo (${MAX_MESSAGE_CHARS} caracteres).`,
      );
    }

    const history = normalizeHistory(body?.history);
    const result = await ragService.query({
      question: message,
      history,
      requestId: context.requestId,
      topK: parseOptionalPositiveInt(body?.topK),
      maxDistance: parseOptionalDistance(body?.maxDistance),
      documentId: parseOptionalPositiveInt(body?.documentId),
      sourceType: normalizeString(body?.sourceType) || undefined,
      retrievalEmbeddingModel: normalizeString(body?.retrievalEmbeddingModel) || undefined,
      maxResponseTokens: parseOptionalPositiveInt(body?.maxResponseTokens),
      temperature: parseOptionalFiniteNumber(body?.temperature),
      seed: parseOptionalSeed(body?.seed),
    });
    logger.info("RAG_CHAT_API_SUCCESS", {
      requestId: context.requestId,
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
      logger.warn("RAG_CHAT_API_ERROR", {
        requestId: context.requestId,
        code: error.code,
        status: error.status,
        message: error.message,
      });
      const safeMessage =
        error.status >= 500
          ? sanitizePublicErrorMessage(error.message, "Falha interna ao executar /api/chat.")
          : error.message;
      return jsonWithCors(
        context,
        { ok: false, code: error.code, message: safeMessage, details: error.details ?? null },
        error.status,
        { methods: ROUTE_OPTIONS.methods },
      );
    }
    const message = error instanceof Error ? error.message : "Falha interna ao executar /api/chat.";
    logger.error("RAG_CHAT_API_INTERNAL_ERROR", { requestId: context.requestId });
    return jsonWithCors(
      context,
      {
        ok: false,
        code: "RAG_CHAT_INTERNAL_ERROR",
        message: sanitizePublicErrorMessage(message, "Falha interna ao executar /api/chat."),
      },
      500,
      { methods: ROUTE_OPTIONS.methods },
    );
  }
}

export async function OPTIONS(req: NextRequest) {
  return handlePublicApiPreflight(req, ROUTE_OPTIONS);
}
