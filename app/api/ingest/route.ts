import { NextRequest } from "next/server";

import {
  createDocumentIngestionService,
  DocumentIngestionError,
  type IngestionActor,
} from "@/core/rag/document-ingestion-service";
import { logger } from "@/core/utils/logger";
import { extractBearerToken, resolveIdentityUser } from "@/lib/identityAuth";

export const runtime = "nodejs";

const SESSION_ID_REGEX = /^[a-zA-Z0-9:_-]{8,128}$/;
const MAX_BULK_ITEMS = 200;

const ingestionService = createDocumentIngestionService();

function normalizeSessionId(value: unknown) {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate) return "";
  if (!SESSION_ID_REGEX.test(candidate)) return "";
  return candidate;
}

function normalizeString(value: unknown) {
  const candidate = typeof value === "string" ? value.trim() : "";
  return candidate || "";
}

function normalizeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function parseJsonMetadata(value: unknown) {
  if (typeof value !== "string") return {};
  const trimmed = value.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    return normalizeMetadata(parsed);
  } catch {
    throw new DocumentIngestionError(400, "INGEST_INVALID_METADATA", "metadata deve ser um JSON valido.");
  }
}

function parseBulkPaths(value: unknown) {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  if (normalized.length > MAX_BULK_ITEMS) {
    throw new DocumentIngestionError(400, "INGEST_BULK_LIMIT", `sourcePaths excede limite maximo (${MAX_BULK_ITEMS}).`);
  }
  return normalized;
}

async function resolveActor(req: NextRequest, sessionIdRaw: unknown, channel: IngestionActor["channel"]): Promise<IngestionActor> {
  const token = extractBearerToken(req);
  const identityUser = token ? await resolveIdentityUser(token).catch(() => null) : null;
  const sessionId = normalizeSessionId(sessionIdRaw);
  return {
    userId: identityUser?.userId ?? null,
    sessionId: sessionId || null,
    channel,
  };
}

function assertFrontendActor(actor: IngestionActor) {
  if (actor.userId || actor.sessionId) return;
  throw new DocumentIngestionError(
    400,
    "INGEST_ACTOR_REQUIRED",
    "Informe sessionId valido ou Authorization Bearer para rastreabilidade da ingestao.",
  );
}

function assertAdminToken(req: NextRequest, bodyToken: unknown) {
  const configuredToken = (process.env.RAG_INGEST_ADMIN_TOKEN || "").trim();
  if (!configuredToken) {
    throw new DocumentIngestionError(
      403,
      "INGEST_BULK_DISABLED",
      "Ingestao em massa desabilitada: configure RAG_INGEST_ADMIN_TOKEN no servidor.",
    );
  }

  const headerToken = normalizeString(req.headers.get("x-rag-admin-token"));
  const candidate = headerToken || normalizeString(bodyToken);
  if (!candidate || candidate !== configuredToken) {
    throw new DocumentIngestionError(403, "INGEST_BULK_UNAUTHORIZED", "Token de super admin invalido.");
  }
}

async function ingestFromMultipart(req: NextRequest) {
  const form = await req.formData();
  const fileEntry = form.get("file");
  if (!(fileEntry instanceof File)) {
    throw new DocumentIngestionError(400, "INGEST_FILE_REQUIRED", "Campo file e obrigatorio em multipart/form-data.");
  }

  const actor = await resolveActor(req, form.get("sessionId"), "frontend");
  assertFrontendActor(actor);

  const bytes = Buffer.from(await fileEntry.arrayBuffer());
  const metadata = parseJsonMetadata(form.get("metadata"));
  const sourceType = normalizeString(form.get("sourceType"));
  const title = normalizeString(form.get("title"));

  const result = await ingestionService.ingest({
    kind: "upload",
    fileName: fileEntry.name || "upload.txt",
    mimeType: fileEntry.type || "",
    bytes,
    sourceType: sourceType || undefined,
    title: title || undefined,
    metadata,
    actor,
  });
  logger.info("RAG_INGEST_API_MULTIPART_OK", {
    documentId: result.documentId,
    duplicate: result.duplicate,
    jobId: result.jobId,
    sourceType: result.sourceType,
  });
  return Response.json({ ok: true, mode: "single", result }, { status: result.duplicate ? 200 : 201 });
}

async function ingestFromJson(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const sourcePaths = parseBulkPaths(body?.sourcePaths);
  if (sourcePaths.length) {
    assertAdminToken(req, body?.adminToken);
    const actor = await resolveActor(req, body?.sessionId, "admin_bulk");
    const sourceType = normalizeString(body?.sourceType) || "server_reference";
    const titlePrefix = normalizeString(body?.titlePrefix);
    const metadata = normalizeMetadata(body?.metadata);
    const batchResults = await ingestionService.ingestBulkByReference(sourcePaths, {
      actor,
      sourceType,
      titlePrefix: titlePrefix || undefined,
      metadata,
    });
    const successCount = batchResults.filter((item) => item.ok).length;
    const failedCount = batchResults.length - successCount;
    logger.info("RAG_INGEST_API_BULK_DONE", {
      total: batchResults.length,
      successCount,
      failedCount,
      sourceType,
    });
    return Response.json(
      {
        ok: failedCount === 0,
        mode: "bulk",
        total: batchResults.length,
        successCount,
        failedCount,
        results: batchResults,
      },
      { status: failedCount === 0 ? 200 : 207 },
    );
  }

  const filePath = normalizeString(body?.filePath);
  if (!filePath) {
    throw new DocumentIngestionError(
      400,
      "INGEST_INPUT_REQUIRED",
      "Informe file (multipart), filePath (json) ou sourcePaths (json) para iniciar ingestao.",
    );
  }

  const actor = await resolveActor(req, body?.sessionId, "frontend");
  assertFrontendActor(actor);

  const sourceType = normalizeString(body?.sourceType);
  const title = normalizeString(body?.title);
  const metadata = normalizeMetadata(body?.metadata);

  const result = await ingestionService.ingest({
    kind: "reference",
    filePath,
    sourceType: sourceType || undefined,
    title: title || undefined,
    metadata,
    actor,
  });
  logger.info("RAG_INGEST_API_REFERENCE_OK", {
    documentId: result.documentId,
    duplicate: result.duplicate,
    jobId: result.jobId,
    sourceType: result.sourceType,
  });
  return Response.json({ ok: true, mode: "single", result }, { status: result.duplicate ? 200 : 201 });
}

export async function POST(req: NextRequest) {
  try {
    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    logger.info("RAG_INGEST_API_REQUEST", { contentType });
    if (contentType.includes("multipart/form-data")) {
      return await ingestFromMultipart(req);
    }
    return await ingestFromJson(req);
  } catch (error) {
    if (error instanceof DocumentIngestionError) {
      logger.warn("RAG_INGEST_API_ERROR", {
        code: error.code,
        status: error.status,
        message: error.message,
      });
      return Response.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Erro interno na ingestao.";
    logger.error("RAG_INGEST_API_INTERNAL_ERROR", { message });
    return Response.json({ ok: false, code: "INGEST_INTERNAL_ERROR", message }, { status: 500 });
  }
}
