export type PdfCitationType = "direct" | "indirect" | "summary";

export type PdfCitationRecord = {
  id: string;
  pdfFileId: string;
  projectId: string;
  documentId: string;
  highlightId?: string;
  citationType: PdfCitationType;
  quotedText?: string;
  paraphrase?: string;
  pageNumber?: number;
  referenceSourceId?: string;
  citationTextAbnt?: string;
  citationTextApa?: string;
  insertedIntoDocument: boolean;
  insertedAtBlockId?: string;
  createdAt: string;
  updatedAt: string;
};

export type PdfCitationExtractionInput = {
  pdfFileId: string;
  projectId: string;
  documentId: string;
  pageNumber: number;
  selectedText: string;
  highlightId?: string;
  citationType: PdfCitationType;
  referenceSourceId?: string;
};

