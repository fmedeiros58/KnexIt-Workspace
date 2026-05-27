import type { PdfDocumentSource } from "../types";
import { createPdfFingerprint } from "../utils";
import { pdfReaderRepository } from "../db/pdfReader.repository";

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildVirtualPdfPath(input: {
  projectId: string;
  documentId?: string;
  pdfFileId: string;
}) {
  if (input.documentId) {
    return `/documents/${input.documentId}/sources/pdf/${input.pdfFileId}.pdf`;
  }
  return `/projects/${input.projectId}/sources/pdf/${input.pdfFileId}.pdf`;
}

export async function upsertPdfFileRecord(input: {
  file: File;
  projectId: string;
  documentId?: string;
  sourceId?: string;
}) {
  const now = new Date().toISOString();
  const fingerprint = await createPdfFingerprint(input.file);
  const existing = await pdfReaderRepository.getPdfFileByFingerprint(fingerprint);
  const pdfFileId = existing?.id ?? createLocalId("pdf");

  const record: PdfDocumentSource = {
    id: pdfFileId,
    projectId: input.projectId,
    documentId: input.documentId,
    sourceId: input.sourceId,
    fileName: input.file.name,
    filePath: buildVirtualPdfPath({
      projectId: input.projectId,
      documentId: input.documentId,
      pdfFileId,
    }),
    mimeType: "application/pdf",
    fileSize: input.file.size,
    fingerprint,
    checksum: fingerprint,
    title: existing?.title,
    author: existing?.author,
    subject: existing?.subject,
    keywords: existing?.keywords,
    producer: existing?.producer,
    creator: existing?.creator,
    creationDate: existing?.creationDate,
    modificationDate: existing?.modificationDate,
    totalPages: existing?.totalPages,
    metadata: existing?.metadata,
    addedAt: existing?.addedAt ?? now,
    updatedAt: now,
    lastOpenedAt: now,
  };

  await pdfReaderRepository.putPdfFile(record);
  await pdfReaderRepository.putPdfFileBlob({
    pdfFileId,
    fileName: input.file.name,
    mimeType: input.file.type || "application/pdf",
    blob: input.file,
    updatedAt: now,
  });

  return record;
}

export async function resolvePdfFileBlob(pdfFileId: string): Promise<File | null> {
  const blobRecord = await pdfReaderRepository.getPdfFileBlob(pdfFileId);
  const fileRecord = await pdfReaderRepository.getPdfFileById(pdfFileId);
  if (!blobRecord || !fileRecord) return null;

  return new File([blobRecord.blob], blobRecord.fileName || fileRecord.fileName, {
    type: blobRecord.mimeType || fileRecord.mimeType || "application/pdf",
    lastModified: Date.parse(blobRecord.updatedAt) || Date.now(),
  });
}
