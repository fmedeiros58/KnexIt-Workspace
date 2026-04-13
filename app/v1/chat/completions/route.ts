import { randomUUID } from "crypto";
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
const MAX_OPENAI_MESSAGES = Number(process.env.PUBLIC_API_MAX_OPENAI_MESSAGES || 30);
const MAX_OPENAI_MESSAGE_CHARS = Number(process.env.PUBLIC_API_MAX_OPENAI_MESSAGE_CHARS || 32000);
const EXPOSE_DEBUG_METADATA_BY_DEFAULT = process.env.PUBLIC_API_EXPOSE_DEBUG_METADATA === "true";

type OpenAiLikeMessage = {
  role?: unknown;
  content?: unknown;
};

type NormalizedMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseOptionalFiniteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalPositiveInt(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const rounded = Math.round(parsed);
  return rounded > 0 ? rounded : undefined;
}

function parseOptionalDistance(value: unknown): number | null | undefined {
  if (value === null) return null;
  return parseOptionalFiniteNumber(value);
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

function normalizeMessages(value: unknown): NormalizedMessage[] {
  if (!Array.isArray(value)) return [];

  if (value.length > MAX_OPENAI_MESSAGES) {
    throw new RagPipelineError(
      400,
      "OPENAI_COMPAT_MESSAGES_TOO_LONG",
      `messages excede limite maximo (${MAX_OPENAI_MESSAGES} itens).`,
    );
  }

  const messages: NormalizedMessage[] = [];

  for (const item of value as OpenAiLikeMessage[]) {
    if (!item || typeof item !== "object") continue;

    const role = item.role;
    if (role !== "system" && role !== "user" && role !== "assistant") continue;

    const content = normalizeString(item.content);
    if (!content) continue;

    if (content.length > MAX_OPENAI_MESSAGE_CHARS) {
      throw new RagPipelineError(
        400,
        "OPENAI_COMPAT_MESSAGE_TOO_LONG",
        `Mensagem excede limite (${MAX_OPENAI_MESSAGE_CHARS} caracteres).`,
      );
    }

    messages.push({ role, content });
  }

  return messages;
}

function extractQuestionAndHistory(messages: NormalizedMessage[]) {
  let lastUserIndex = -1;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") {
      lastUserIndex = index;
      break;
    }
  }

  if (lastUserIndex < 0) {
    throw new RagPipelineError(
      400,
      "OPENAI_COMPAT_USER_MESSAGE_REQUIRED",
      "Payload OpenAI-compatible precisa conter ao menos uma mensagem role=user.",
    );
  }

  const question = messages[lastUserIndex].content;
  const history = messages
    .slice(0, lastUserIndex)
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content,
    }));

  return { question, history };
}

function toUsageNumber(value: number | null | undefined) {
  return Number.isFinite(value as number) ? Math.max(0, Math.trunc(value as number)) : 0;
}

function openAiErrorPayload(message: string, code: string, type = "invalid_request_error", param: string | null = null) {
  return {
    error: {
      message,
      type,
      param,
      code,
    },
  };
}

function shouldExposeDebugMetadata(req: NextRequest) {
  if (!EXPOSE_DEBUG_METADATA_BY_DEFAULT) {
    return false;
  }

  const headerValue = normalizeString(req.headers.get("x-debug-rag"));
  return headerValue === "1" || headerValue.toLowerCase() === "true";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function getNestedRecord(source: Record<string, unknown> | null, key: string) {
  if (!source) return null;
  return asRecord(source[key]);
}

function getNestedNumber(source: Record<string, unknown> | null, key: string) {
  if (!source) return undefined;
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getNestedString(source: Record<string, unknown> | null, key: string) {
  if (!source) return undefined;
  const value = source[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function buildSafePublicKnexRag(metadata: unknown) {
  const root = asRecord(metadata);
  const llm = getNestedRecord(root, "llm");
  const usage = getNestedRecord(llm, "usage");
  const timingsMs = getNestedRecord(root, "timingsMs");

  const safe = {
    llm: {
      model: getNestedString(llm, "model") ?? null,
      finishReason: getNestedString(llm, "finishReason") ?? "stop",
      usage: {
        promptTokens: toUsageNumber(getNestedNumber(usage, "promptTokens") ?? null),
        completionTokens: toUsageNumber(getNestedNumber(usage, "completionTokens") ?? null),
        totalTokens: toUsageNumber(getNestedNumber(usage, "totalTokens") ?? null),
      },
    },
    timingsMs: {
      total: getNestedNumber(timingsMs, "total") ?? null,
    },
  };

  return safe;
}

export async function OPTIONS(req: NextRequest) {
  return handlePublicApiPreflight(req, ROUTE_OPTIONS);
}

export async function POST(req: NextRequest) {
  const { context, response } = enforcePublicApiRequest(req, ROUTE_OPTIONS);
  if (response) return response;

  logger.info("OPENAI_COMPAT_REQUEST", {
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    clientIp: context.clientIp,
  });

  try {
    const parsed = await readJsonBodyWithLimit(req, context, { methods: ROUTE_OPTIONS.methods });
    if (parsed.response) return parsed.response;

    const body = parsed.body || {};

    if (body?.stream === true) {
      throw new RagPipelineError(
        400,
        "OPENAI_COMPAT_STREAM_UNSUPPORTED",
        "stream=true ainda nao suportado no adaptador /v1/chat/completions.",
      );
    }

    const messages = normalizeMessages(body?.messages);
    const { question, history } = extractQuestionAndHistory(messages);

    const topK = parseOptionalPositiveInt(body?.top_k ?? body?.topK ?? body?.extra_body?.topK);
    const maxDistance = parseOptionalDistance(body?.max_distance ?? body?.maxDistance ?? body?.extra_body?.maxDistance);
    const documentId = parseOptionalPositiveInt(body?.document_id ?? body?.documentId ?? body?.extra_body?.documentId);
    const sourceType = normalizeString(body?.source_type ?? body?.sourceType ?? body?.extra_body?.sourceType) || undefined;
    const retrievalEmbeddingModel =
      normalizeString(body?.retrieval_embedding_model ?? body?.retrievalEmbeddingModel ?? body?.extra_body?.retrievalEmbeddingModel) ||
      undefined;
    const pipelineVersion =
      parsePipelineVersion(body?.pipeline) ||
      parsePipelineVersion(body?.extra_body?.pipeline) ||
      parsePipelineVersion(req.headers.get("x-pipeline"));

    const result = await ragService.query({
      question,
      history,
      requestId: context.requestId,
      pipelineVersion,
      topK,
      maxDistance,
      documentId,
      sourceType,
      retrievalEmbeddingModel,
      maxResponseTokens: parseOptionalPositiveInt(body?.max_tokens),
      temperature: parseOptionalFiniteNumber(body?.temperature),
      seed: parseOptionalSeed(body?.seed),
    });

    const completionId = `chatcmpl-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const created = Math.floor(Date.now() / 1000);
    const finishReason = result.metadata.llm.finishReason || "stop";
    const usage = result.metadata.llm.usage;
    const exposeDebugMetadata = shouldExposeDebugMetadata(req);

    logger.info("OPENAI_COMPAT_SUCCESS", {
      requestId: context.requestId,
      totalMs: result.metadata.timingsMs.total,
      answerChars: result.answer.length,
      model: result.metadata.llm.model,
      exposeDebugMetadata,
    });

    return jsonWithCors(
      context,
      {
        id: completionId,
        object: "chat.completion",
        created,
        model: result.metadata.llm.model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: result.answer,
            },
            finish_reason: finishReason,
          },
        ],
        usage: {
          prompt_tokens: toUsageNumber(usage.promptTokens),
          completion_tokens: toUsageNumber(usage.completionTokens),
          total_tokens: toUsageNumber(usage.totalTokens),
        },
        ...(exposeDebugMetadata ? { knex_rag: buildSafePublicKnexRag(result.metadata) } : {}),
      },
      200,
      { methods: ROUTE_OPTIONS.methods },
    );
  } catch (error) {
    if (error instanceof RagPipelineError) {
      logger.warn("OPENAI_COMPAT_ERROR", {
        requestId: context.requestId,
        code: error.code,
        status: error.status,
      });

      const safeMessage =
        error.status >= 500
          ? sanitizePublicErrorMessage(error.message, "Falha interna no adaptador OpenAI-compatible.")
          : error.message;

      return jsonWithCors(
        context,
        openAiErrorPayload(safeMessage, error.code),
        error.status,
        { methods: ROUTE_OPTIONS.methods },
      );
    }

    const message = error instanceof Error ? error.message : "Falha interna no adaptador OpenAI-compatible.";

    logger.error("OPENAI_COMPAT_INTERNAL_ERROR", {
      requestId: context.requestId,
    });

    return jsonWithCors(
      context,
      openAiErrorPayload(
        sanitizePublicErrorMessage(message, "Falha interna no adaptador OpenAI-compatible."),
        "OPENAI_COMPAT_INTERNAL_ERROR",
        "server_error",
      ),
      500,
      { methods: ROUTE_OPTIONS.methods },
    );
  }
}