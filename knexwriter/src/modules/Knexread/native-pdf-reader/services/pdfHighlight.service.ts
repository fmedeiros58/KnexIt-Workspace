import { pdfReaderRepository } from "../db/pdfReader.repository";
import type { PdfHighlightColor, PdfHighlightRecord, PdfTextSelection } from "../types";
import { normalizePdfText } from "../utils";

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function createPdfHighlight(input: {
  pdfFileId: string;
  projectId: string;
  documentId?: string;
  selection: PdfTextSelection;
  color?: PdfHighlightColor;
  note?: string;
}): Promise<PdfHighlightRecord> {
  const now = new Date().toISOString();
  const highlight: PdfHighlightRecord = {
    id: createLocalId("pdf-highlight"),
    pdfFileId: input.pdfFileId,
    projectId: input.projectId,
    documentId: input.documentId,
    pageNumber: input.selection.pageNumber,
    selectedText: input.selection.selectedText,
    normalizedText: normalizePdfText(input.selection.selectedText),
    color: input.color ?? "yellow",
    note: input.note,
    rects: input.selection.rects,
    anchor: input.selection.anchor,
    createdAt: now,
    updatedAt: now,
  };

  await pdfReaderRepository.putHighlight(highlight);
  return highlight;
}

export function listPdfHighlights(pdfFileId: string) {
  return pdfReaderRepository.listHighlightsByPdfFile(pdfFileId);
}

export function updatePdfHighlight(id: string, patch: Partial<PdfHighlightRecord>) {
  return pdfReaderRepository.updateHighlight(id, patch);
}

export function deletePdfHighlight(id: string) {
  return pdfReaderRepository.deleteHighlight(id);
}

