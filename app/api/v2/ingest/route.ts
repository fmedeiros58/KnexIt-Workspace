import { NextRequest } from "next/server";

import { DocumentIngestV2 } from "@/core/rag/v2/docs/ingest_v2";
import { logger } from "@/core/utils/logger";

export const runtime = "nodejs";

const ingestV2 = new DocumentIngestV2();
const MAX_FILE_BYTES = Number(process.env.RAG_MAX_FILE_SIZE_BYTES || 20 * 1024 * 1024);

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseOptionalPositiveInt(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const rounded = Math.trunc(parsed);
  return rounded > 0 ? rounded : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("multipart/form-data")) {
      return Response.json(
        {
          ok: false,
          code: "RAG_V2_INGEST_MULTIPART_REQUIRED",
          message: "Use multipart/form-data com campo file para ingestao v2.",
        },
        { status: 400 },
      );
    }

    const form = await req.formData();
    const fileEntry = form.get("file");
    if (!(fileEntry instanceof File)) {
      return Response.json(
        {
          ok: false,
          code: "RAG_V2_INGEST_FILE_REQUIRED",
          message: "Campo file e obrigatorio.",
        },
        { status: 400 },
      );
    }

    const mime = normalizeString(fileEntry.type || "application/pdf") || "application/pdf";
    if (mime !== "application/pdf") {
      return Response.json(
        {
          ok: false,
          code: "RAG_V2_INGEST_UNSUPPORTED_MIME",
          message: "Ingestao v2 atual aceita apenas application/pdf.",
        },
        { status: 415 },
      );
    }

    const bytes = Buffer.from(await fileEntry.arrayBuffer());
    if (bytes.length > MAX_FILE_BYTES) {
      return Response.json(
        {
          ok: false,
          code: "RAG_V2_INGEST_FILE_TOO_LARGE",
          message: `Arquivo excede limite maximo (${MAX_FILE_BYTES} bytes).`,
        },
        { status: 413 },
      );
    }

    const result = await ingestV2.ingestPdf({
      userId: normalizeString(form.get("userId")) || null,
      projectId: normalizeString(form.get("projectId")) || null,
      filename: normalizeString(fileEntry.name) || "documento.pdf",
      mime,
      bytes,
      pipelineVersion: "v2",
      embeddingVersion: normalizeString(form.get("embeddingVersion")) || "v2-default",
      chunkSizeChars: parseOptionalPositiveInt(form.get("chunkSizeChars")),
      overlapChars: parseOptionalPositiveInt(form.get("overlapChars")),
      minTextPerPage: parseOptionalPositiveInt(form.get("minTextPerPage")),
    });

    logger.info("RAG_V2_INGEST_SUCCESS", {
      docId: result.docId,
      pageCount: result.pageCount,
      chunkCount: result.chunkCount,
      embeddingModel: result.embedding.embeddingModel,
    });

    return Response.json(
      {
        ok: true,
        pipelineVersion: "v2",
        result,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("RAG_V2_INGEST_ERROR", { message });
    return Response.json(
      {
        ok: false,
        code: "RAG_V2_INGEST_INTERNAL_ERROR",
        message,
      },
      { status: 500 },
    );
  }
}

