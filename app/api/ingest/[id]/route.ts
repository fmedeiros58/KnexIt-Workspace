import { createDocumentIngestionService, DocumentIngestionError } from "@/core/rag/document-ingestion-service";

export const runtime = "nodejs";

const ingestionService = createDocumentIngestionService();

function parseId(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new DocumentIngestionError(400, "INGEST_JOB_ID_INVALID", "id de ingestion invalido.");
  }
  return parsed;
}

export async function GET(_: Request, context: { params: { id: string } }) {
  try {
    const id = parseId(context.params.id);
    const job = await ingestionService.getIngestionJobById(id);
    if (!job) {
      return Response.json({ ok: false, code: "INGEST_JOB_NOT_FOUND", message: "Ingestion job nao encontrado." }, { status: 404 });
    }
    return Response.json({ ok: true, job }, { status: 200 });
  } catch (error) {
    if (error instanceof DocumentIngestionError) {
      return Response.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Erro interno ao consultar ingestion job.";
    return Response.json({ ok: false, code: "INGEST_JOB_INTERNAL_ERROR", message }, { status: 500 });
  }
}

