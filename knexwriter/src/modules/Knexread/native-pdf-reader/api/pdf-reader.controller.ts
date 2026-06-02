import type {
  PdfAnnotationRecord,
  PdfCitationRecord,
  PdfHighlightRecord,
  PdfReaderPreferencesRecord,
  PdfReaderSessionRecord,
  PdfTranslationBlockRecord,
  PdfTranslationRuntime,
  PdfTranslationStrategy,
  PdfSourceCandidate,
} from "../types";
import { pdfReaderService } from "./pdf-reader.service";

export const pdfReaderController = {
  getFile(fileId: string) {
    return pdfReaderService.getPdfFile(fileId);
  },

  listProjectFiles(projectId: string) {
    return pdfReaderService.listProjectFiles(projectId);
  },

  resolveStoredFile(pdfFileId: string) {
    return pdfReaderService.resolveStoredFile(pdfFileId);
  },

  open(input: { file: File; projectId: string; documentId?: string; sourceId?: string }) {
    return pdfReaderService.open(input);
  },

  getSession(pdfFileId: string) {
    return pdfReaderService.getSession(pdfFileId);
  },

  updateSession(
    pdfFileId: string,
    patch: Partial<PdfReaderSessionRecord>,
  ) {
    return pdfReaderService.updateSession(pdfFileId, patch);
  },

  listHighlights(pdfFileId: string): Promise<PdfHighlightRecord[]> {
    return pdfReaderService.getHighlights(pdfFileId);
  },

  createHighlight: pdfReaderService.createHighlight.bind(pdfReaderService),

  updateHighlight(highlightId: string, patch: Partial<PdfHighlightRecord>) {
    return pdfReaderService.updateHighlight(highlightId, patch);
  },

  deleteHighlight(highlightId: string) {
    return pdfReaderService.deleteHighlight(highlightId);
  },

  listAnnotations(pdfFileId: string): Promise<PdfAnnotationRecord[]> {
    return pdfReaderService.getAnnotations(pdfFileId);
  },

  createAnnotation: pdfReaderService.createAnnotation.bind(pdfReaderService),

  updateAnnotation(annotationId: string, patch: Partial<PdfAnnotationRecord>) {
    return pdfReaderService.updateAnnotation(annotationId, patch);
  },

  deleteAnnotation(annotationId: string) {
    return pdfReaderService.deleteAnnotation(annotationId);
  },

  listCitations(pdfFileId: string): Promise<PdfCitationRecord[]> {
    return pdfReaderService.listCitations(pdfFileId);
  },

  createCitation: pdfReaderService.createCitation.bind(pdfReaderService),

  insertCitationIntoDocument(citationId: string, insertedAtBlockId?: string) {
    return pdfReaderService.insertCitationIntoDocument({ citationId, insertedAtBlockId });
  },

  createReferenceCandidate(candidate: PdfSourceCandidate) {
    return pdfReaderService.saveReferenceCandidate(candidate);
  },

  persistPageGeoBlocks: pdfReaderService.persistPageGeoBlocks.bind(pdfReaderService),

  ensureTranslationLayerForPage: pdfReaderService.ensureTranslationLayerForPage.bind(
    pdfReaderService,
  ),

  listTranslationBlocks(pdfFileId: string): Promise<PdfTranslationBlockRecord[]> {
    return pdfReaderService.listTranslationBlocks(pdfFileId);
  },

  listTranslationBlocksByPage(
    pdfFileId: string,
    pageNumber: number,
  ): Promise<PdfTranslationBlockRecord[]> {
    return pdfReaderService.listTranslationBlocksByPage(pdfFileId, pageNumber);
  },

  updateTranslationBlockText: pdfReaderService.updateTranslationBlockText.bind(
    pdfReaderService,
  ),

  translatePage(input: {
    pdfFileId: string;
    pageNumber: number;
    strategy: PdfTranslationStrategy;
    runtime?: PdfTranslationRuntime;
    preferredProviderId?: string;
    sourceLanguage?: string;
    targetLanguage: string;
    onlyPending?: boolean;
  }) {
    return pdfReaderService.translatePage(input);
  },

  translateDocument(input: {
    pdfFileId: string;
    strategy: PdfTranslationStrategy;
    runtime?: PdfTranslationRuntime;
    preferredProviderId?: string;
    sourceLanguage?: string;
    targetLanguage: string;
    onlyPending?: boolean;
  }) {
    return pdfReaderService.translateDocument(input);
  },

  getReaderPreferences(input: {
    projectId: string;
    documentId?: string;
  }): Promise<PdfReaderPreferencesRecord> {
    return pdfReaderService.getReaderPreferences(input);
  },

  updateReaderPreferences(input: {
    projectId: string;
    documentId?: string;
    patch: Partial<PdfReaderPreferencesRecord>;
  }): Promise<PdfReaderPreferencesRecord> {
    return pdfReaderService.updateReaderPreferences(input);
  },
};
