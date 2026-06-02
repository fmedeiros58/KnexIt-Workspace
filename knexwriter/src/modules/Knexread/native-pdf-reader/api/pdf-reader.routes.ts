export const pdfReaderRoutes = {
  getFile: (fileId: string) => `/api/pdf-reader/files/${fileId}`,
  open: "/api/pdf-reader/open",
  getSession: (pdfFileId: string) => `/api/pdf-reader/${pdfFileId}/session`,
  updateSession: (pdfFileId: string) => `/api/pdf-reader/${pdfFileId}/session`,
  listHighlights: (pdfFileId: string) => `/api/pdf-reader/${pdfFileId}/highlights`,
  createHighlights: (pdfFileId: string) => `/api/pdf-reader/${pdfFileId}/highlights`,
  updateHighlight: (highlightId: string) =>
    `/api/pdf-reader/highlights/${highlightId}`,
  deleteHighlight: (highlightId: string) =>
    `/api/pdf-reader/highlights/${highlightId}`,
  listAnnotations: (pdfFileId: string) =>
    `/api/pdf-reader/${pdfFileId}/annotations`,
  createAnnotation: (pdfFileId: string) =>
    `/api/pdf-reader/${pdfFileId}/annotations`,
  updateAnnotation: (annotationId: string) =>
    `/api/pdf-reader/annotations/${annotationId}`,
  deleteAnnotation: (annotationId: string) =>
    `/api/pdf-reader/annotations/${annotationId}`,
  extractMetadata: (pdfFileId: string) =>
    `/api/pdf-reader/${pdfFileId}/extract-metadata`,
  createReferenceCandidate: (pdfFileId: string) =>
    `/api/pdf-reader/${pdfFileId}/create-reference-candidate`,
  createCitation: (pdfFileId: string) =>
    `/api/pdf-reader/${pdfFileId}/create-citation`,
  insertCitationIntoDocument: (citationId: string) =>
    `/api/pdf-reader/citations/${citationId}/insert-into-document`,
  persistGeoBlocks: (pdfFileId: string) =>
    `/api/pdf-reader/${pdfFileId}/geo-blocks`,
  listTranslationBlocks: (pdfFileId: string) =>
    `/api/pdf-reader/${pdfFileId}/translation-blocks`,
  listTranslationBlocksByPage: (pdfFileId: string, pageNumber: number) =>
    `/api/pdf-reader/${pdfFileId}/translation-blocks/pages/${pageNumber}`,
  updateTranslationBlock: (translationBlockId: string) =>
    `/api/pdf-reader/translation-blocks/${translationBlockId}`,
  translatePage: (pdfFileId: string, pageNumber: number) =>
    `/api/pdf-reader/${pdfFileId}/translate/pages/${pageNumber}`,
  translateDocument: (pdfFileId: string) =>
    `/api/pdf-reader/${pdfFileId}/translate/document`,
  readerPreferences: (projectId: string, documentId?: string) =>
    `/api/pdf-reader/preferences/${projectId}${documentId ? `/${documentId}` : ""}`,
} as const;
