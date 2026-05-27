export type PdfAnnotationType =
  | "comment"
  | "note"
  | "question"
  | "summary"
  | "citation-candidate";

export type PdfAnnotationRecord = {
  id: string;
  pdfFileId: string;
  projectId: string;
  documentId?: string;
  highlightId?: string;
  pageNumber: number;
  annotationType: PdfAnnotationType;
  content: string;
  createdAt: string;
  updatedAt: string;
};

