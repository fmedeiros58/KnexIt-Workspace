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
const MAX_QUESTION_CHARS = Number(process.env.PUBLIC_API_MAX_QUESTION_CHARS || 4000);

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

export async function POST(req: NextRequest) {
  const { context, response } = enforcePublicApiRequest(req, ROUTE_OPTIONS);
  if (response) return response;
  logger.info("RAG_QUERY_API_REQUEST", { requestId: context.requestId, path: context.path });

  try {
    const parsed = await readJsonBodyWithLimit(req, context, { methods: ROUTE_OPTIONS.methods });
    if (parsed.response) return parsed.response;
    const body = parsed.body || {};
    const question = normalizeString(body?.question) || normalizeString(body?.prompt);
    if (!question) {
      throw new RagPipelineError(400, "RAG_QUESTION_REQUIRED", "Envie question (ou prompt) para executar retrieval.");
    }
    if (question.length > MAX_QUESTION_CHARS) {
      throw new RagPipelineError(
        400,
        "RAG_QUERY_TOO_LONG",
        `question excede limite maximo (${MAX_QUESTION_CHARS} caracteres).`,
      );
    }

    const result = await ragService.query({
      question,
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
    logger.info("RAG_QUERY_API_SUCCESS", {
      requestId: context.requestId,
      totalMs: result.metadata.timingsMs.total,
      retrievedChunks: result.metadata.retrieval.returnedChunks,
    });

    return jsonWithCors(
      context,
      {
        ok: true,
        question,
        answer: result.answer,
        metadata: result.metadata,
      },
      200,
      { methods: ROUTE_OPTIONS.methods },
    );
  } catch (error) {
    if (error instanceof RagPipelineError) {
      logger.warn("RAG_QUERY_API_ERROR", {
        requestId: context.requestId,
        code: error.code,
        status: error.status,
        message: error.message,
      });
      const safeMessage =
        error.status >= 500
          ? sanitizePublicErrorMessage(error.message, "Falha interna ao executar /api/query.")
          : error.message;
      return jsonWithCors(
        context,
        { ok: false, code: error.code, message: safeMessage, details: error.details ?? null },
        error.status,
        { methods: ROUTE_OPTIONS.methods },
      );
    }
    const message = error instanceof Error ? error.message : "Falha interna ao executar /api/query.";
    logger.error("RAG_QUERY_API_INTERNAL_ERROR", { requestId: context.requestId });
    return jsonWithCors(
      context,
      {
        ok: false,
        code: "RAG_QUERY_INTERNAL_ERROR",
        message: sanitizePublicErrorMessage(message, "Falha interna ao executar /api/query."),
      },
      500,
      { methods: ROUTE_OPTIONS.methods },
    );
  }
}

export async function OPTIONS(req: NextRequest) {
  return handlePublicApiPreflight(req, ROUTE_OPTIONS);
}
