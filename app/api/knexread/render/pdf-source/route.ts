import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function normalizeLocalSourceId(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getLocalPdfSourcePath(pdfFileId: string): string {
  const sourceRoot =
    process.env.KNEXREAD_TILE_SOURCE_LOCAL_DIR?.trim() ||
    join(process.cwd(), ".cache", "knexread", "pdf-sources");

  return join(sourceRoot, `${normalizeLocalSourceId(pdfFileId)}.pdf`);
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json(
      { ok: false, reason: "multipart-form-data-required" },
      { status: 400 },
    );
  }

  const pdfFileId = formData.get("pdfFileId");
  const file = formData.get("file");

  if (typeof pdfFileId !== "string" || pdfFileId.trim().length === 0) {
    return NextResponse.json(
      { ok: false, reason: "pdfFileId-required" },
      { status: 400 },
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, reason: "file-required" },
      { status: 400 },
    );
  }

  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json(
      { ok: false, reason: "application-pdf-required" },
      { status: 415 },
    );
  }

  const targetPath = getLocalPdfSourcePath(pdfFileId.trim());
  const bytes = Buffer.from(await file.arrayBuffer());

  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, bytes);

  return NextResponse.json({
    ok: true,
    pdfFileId: pdfFileId.trim(),
    byteSize: bytes.byteLength,
    source: "local-renderer-cache",
  });
}
