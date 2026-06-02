import { pdfReaderRepository } from "../db/pdfReader.repository";
import type { PdfAnnotationRecord, PdfAnnotationType } from "../types";

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function createPdfAnnotation(input: {
  pdfFileId: string;
  projectId: string;
  documentId?: string;
  pageNumber: number;
  content: string;
  annotationType?: PdfAnnotationType;
  highlightId?: string;
}) {
  const now = new Date().toISOString();
  const record: PdfAnnotationRecord = {
    id: createLocalId("pdf-annotation"),
    pdfFileId: input.pdfFileId,
    projectId: input.projectId,
    documentId: input.documentId,
    pageNumber: input.pageNumber,
    content: input.content,
    annotationType: input.annotationType ?? "comment",
    highlightId: input.highlightId,
    createdAt: now,
    updatedAt: now,
  };

  await pdfReaderRepository.putAnnotation(record);
  return record;
}

export function listPdfAnnotations(pdfFileId: string) {
  return pdfReaderRepository.listAnnotationsByPdfFile(pdfFileId);
}

export function updatePdfAnnotation(id: string, patch: Partial<PdfAnnotationRecord>) {
  return pdfReaderRepository.updateAnnotation(id, patch);
}

export function deletePdfAnnotation(id: string) {
  return pdfReaderRepository.deleteAnnotation(id);
}

