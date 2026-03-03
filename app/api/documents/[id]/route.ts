import { createDocumentIngestionService, DocumentIngestionError } from "@/core/rag/document-ingestion-service";

export const runtime = "nodejs";

const ingestionService = createDocumentIngestionService();

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return parsed;
}

function parseDocumentId(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new DocumentIngestionError(400, "DOCUMENT_ID_INVALID", "id de documento invalido.");
  }
  return parsed;
}

export async function GET(req: Request, context: { params: { id: string } }) {
  try {
    const documentId = parseDocumentId(context.params.id);
    const { searchParams } = new URL(req.url);
    const limit = Math.min(1000, Math.max(1, parsePositiveInt(searchParams.get("limit"), 200)));
    const offset = Math.max(0, parsePositiveInt(searchParams.get("offset"), 0));

    const document = await ingestionService.getDocumentById(documentId, { limit, offset });
    if (!document) {
      return Response.json({ ok: false, code: "DOCUMENT_NOT_FOUND", message: "Documento nao encontrado." }, { status: 404 });
    }

    return Response.json(
      {
        ok: true,
        document,
        pagination: {
          limit,
          offset,
          totalChunks: document.totalChunks,
          hasMore: offset + document.chunks.length < document.totalChunks,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof DocumentIngestionError) {
      return Response.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Erro interno ao consultar documento.";
    return Response.json({ ok: false, code: "DOCUMENT_INTERNAL_ERROR", message }, { status: 500 });
  }
}

