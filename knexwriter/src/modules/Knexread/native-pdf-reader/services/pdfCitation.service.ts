import { pdfReaderRepository } from "../db/pdfReader.repository";
import type {
  PdfCitationExtractionInput,
  PdfCitationRecord,
  PdfCitationType,
} from "../types";
import { buildPdfQuote } from "../utils";

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildCitationText(input: {
  citationType: PdfCitationType;
  selectedText: string;
  pageNumber: number;
}) {
  if (input.citationType === "direct") {
    return `${buildPdfQuote(input.selectedText)} (p. ${input.pageNumber})`;
  }
  if (input.citationType === "indirect") {
    return `Síntese da página ${input.pageNumber}: ${input.selectedText}`;
  }
  return `Resumo (p. ${input.pageNumber}): ${input.selectedText}`;
}

export async function createPdfCitationFromSelection(
  input: PdfCitationExtractionInput,
): Promise<PdfCitationRecord> {
  const now = new Date().toISOString();
  const citationText = buildCitationText({
    citationType: input.citationType,
    selectedText: input.selectedText,
    pageNumber: input.pageNumber,
  });

  const record: PdfCitationRecord = {
    id: createLocalId("pdf-citation"),
    pdfFileId: input.pdfFileId,
    projectId: input.projectId,
    documentId: input.documentId,
    highlightId: input.highlightId,
    citationType: input.citationType,
    quotedText: input.citationType === "direct" ? input.selectedText : undefined,
    paraphrase: input.citationType !== "direct" ? input.selectedText : undefined,
    pageNumber: input.pageNumber,
    referenceSourceId: input.referenceSourceId,
    citationTextAbnt: citationText,
    citationTextApa: citationText,
    insertedIntoDocument: false,
    createdAt: now,
    updatedAt: now,
  };

  await pdfReaderRepository.putCitation(record);
  return record;
}

export function listPdfCitations(pdfFileId: string) {
  return pdfReaderRepository.listCitationsByPdfFile(pdfFileId);
}

export async function markCitationAsInserted(input: {
  citationId: string;
  insertedAtBlockId?: string;
}) {
  return pdfReaderRepository.updateCitation(input.citationId, {
    insertedIntoDocument: true,
    insertedAtBlockId: input.insertedAtBlockId,
  });
}

