import { NextRequest } from "next/server";

import {
  enforcePublicApiRequest,
  handlePublicApiPreflight,
  jsonWithCors,
  readJsonBodyWithLimit,
  sanitizePublicErrorMessage,
} from "@/app/api/_shared/public-api";
import { RagPipelineError } from "@/core/rag/rag-errors";
import { createRagQueryService } from "@/core/rag/rag-query-service";
import { logger } from "@/core/utils/logger";

export const runtime = "nodejs";

const ragService = createRagQueryService();
const ROUTE_OPTIONS = { methods: ["POST"], requireApiKey: true } as const;
const MAX_QUESTION_CHARS = Number(process.env.PUBLIC_API_MAX_QUESTION_CHARS || 32000);

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

function parsePipelineVersion(value: unknown): "v1" | "v2" | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "v1" || normalized === "v2") return normalized;
  return undefined;
}

export async function OPTIONS(req: NextRequest) {
  return handlePublicApiPreflight(req, ROUTE_OPTIONS);
}

export async function POST(req: NextRequest) {
  const { context, response } = enforcePublicApiRequest(req, ROUTE_OPTIONS);
  if (response) return response;
  logger.info("PUBLIC_QUERY_REQUEST", {
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    clientIp: context.clientIp,
  });

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
        "PUBLIC_QUERY_TOO_LONG",
        `question excede limite maximo (${MAX_QUESTION_CHARS} caracteres).`,
      );
    }
    const pipelineVersion = parsePipelineVersion(body?.pipeline) || parsePipelineVersion(req.headers.get("x-pipeline"));

    const result = await ragService.query({
      question,
      requestId: context.requestId,
      pipelineVersion,
      topK: parseOptionalPositiveInt(body?.topK),
      maxDistance: parseOptionalDistance(body?.maxDistance),
      documentId: parseOptionalPositiveInt(body?.documentId),
      sourceType: normalizeString(body?.sourceType) || undefined,
      retrievalEmbeddingModel: normalizeString(body?.retrievalEmbeddingModel) || undefined,
      maxResponseTokens: parseOptionalPositiveInt(body?.maxResponseTokens),
      temperature: parseOptionalFiniteNumber(body?.temperature),
      seed: parseOptionalSeed(body?.seed),
    });
    logger.info("PUBLIC_QUERY_SUCCESS", {
      requestId: context.requestId,
      answerChars: result.answer.length,
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
      logger.warn("PUBLIC_QUERY_ERROR", {
        requestId: context.requestId,
        code: error.code,
        status: error.status,
      });
      const safeMessage =
        error.status >= 500
          ? sanitizePublicErrorMessage(error.message, "Falha interna ao executar /query.")
          : error.message;
      return jsonWithCors(
        context,
        { ok: false, code: error.code, message: safeMessage, details: error.details ?? null },
        error.status,
        { methods: ROUTE_OPTIONS.methods },
      );
    }

    const message = error instanceof Error ? error.message : "Falha interna ao executar /query.";
    logger.error("PUBLIC_QUERY_INTERNAL_ERROR", { requestId: context.requestId });
    return jsonWithCors(
      context,
      {
        ok: false,
        code: "RAG_QUERY_INTERNAL_ERROR",
        message: sanitizePublicErrorMessage(message, "Falha interna ao executar /query."),
      },
      500,
      { methods: ROUTE_OPTIONS.methods },
    );
  }
}
