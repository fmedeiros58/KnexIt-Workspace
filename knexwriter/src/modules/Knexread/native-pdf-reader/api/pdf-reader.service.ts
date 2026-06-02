import { pdfReaderRepository } from "../db/pdfReader.repository";
import type {
  PdfAnnotationRecord,
  PdfCitationRecord,
  PdfDocumentSource,
  PdfHighlightRecord,
  PdfReaderPreferencesRecord,
  PdfReaderSessionRecord,
  PdfSourceCandidate,
  PdfTranslationBlockRecord,
  PdfTranslationRuntime,
  PdfTranslationStrategy,
} from "../types";
import {
  buildPdfSourceCandidate,
  createPdfAnnotation,
  createPdfCitationFromSelection,
  createPdfHighlight,
  listPdfAnnotations,
  listPdfCitations,
  listPdfHighlights,
  markCitationAsInserted,
  ensureTranslationLayerForPage,
  listTranslationBlocksForPage,
  listTranslationBlocksForPdf,
  loadOrCreateReaderPreferences,
  persistGeoTextBlocks,
  translateDocumentBlocks,
  translatePageBlocks,
  updateReaderPreferences,
  updateTranslationBlockText,
  updatePdfAnnotation,
  updatePdfHighlight,
  upsertPdfFileRecord,
  resolvePdfFileBlob,
} from "../services";
import {
  deletePdfAnnotation,
  deletePdfHighlight,
} from "../services";

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export class PdfReaderService {
  async getPdfFile(fileId: string): Promise<PdfDocumentSource | null> {
    return pdfReaderRepository.getPdfFileById(fileId);
  }

  async listProjectFiles(projectId: string): Promise<PdfDocumentSource[]> {
    const files = await pdfReaderRepository.listPdfFilesByProject(projectId);
    return [...files].sort((a, b) => {
      const aTime = a.lastOpenedAt ?? a.updatedAt ?? a.addedAt;
      const bTime = b.lastOpenedAt ?? b.updatedAt ?? b.addedAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }

  async resolveStoredFile(pdfFileId: string): Promise<File | null> {
    return resolvePdfFileBlob(pdfFileId);
  }

  async open(input: {
    file: File;
    projectId: string;
    documentId?: string;
    sourceId?: string;
  }): Promise<{
    pdfFile: PdfDocumentSource;
    session: PdfReaderSessionRecord;
  }> {
    const pdfFile = await upsertPdfFileRecord({
      file: input.file,
      projectId: input.projectId,
      documentId: input.documentId,
      sourceId: input.sourceId,
    });

    const now = new Date().toISOString();
    const previousSession = await pdfReaderRepository.getSessionByPdfFile(pdfFile.id);
    const session: PdfReaderSessionRecord = previousSession ?? {
      id: createLocalId("pdf-session"),
      pdfFileId: pdfFile.id,
      projectId: input.projectId,
      documentId: input.documentId,
      currentPage: 1,
      zoom: 100,
      rotation: 0,
      viewMode: "single-page",
      sidebarMode: "thumbnails",
      createdAt: now,
      updatedAt: now,
    };

    await pdfReaderRepository.putSession({
      ...session,
      updatedAt: now,
    });

    return { pdfFile, session: { ...session, updatedAt: now } };
  }

  async getSession(pdfFileId: string) {
    return pdfReaderRepository.getSessionByPdfFile(pdfFileId);
  }

  async updateSession(
    pdfFileId: string,
    patch: Partial<PdfReaderSessionRecord>,
  ): Promise<PdfReaderSessionRecord | null> {
    const current = await pdfReaderRepository.getSessionByPdfFile(pdfFileId);
    if (!current) return null;
    const next: PdfReaderSessionRecord = {
      ...current,
      ...patch,
      id: current.id,
      pdfFileId: current.pdfFileId,
      updatedAt: new Date().toISOString(),
    };
    await pdfReaderRepository.putSession(next);
    return next;
  }

  getHighlights(pdfFileId: string): Promise<PdfHighlightRecord[]> {
    return listPdfHighlights(pdfFileId);
  }

  createHighlight: typeof createPdfHighlight = createPdfHighlight;

  updateHighlight(
    highlightId: string,
    patch: Partial<PdfHighlightRecord>,
  ): Promise<PdfHighlightRecord | null> {
    return updatePdfHighlight(highlightId, patch);
  }

  deleteHighlight(highlightId: string): Promise<void> {
    return deletePdfHighlight(highlightId);
  }

  getAnnotations(pdfFileId: string): Promise<PdfAnnotationRecord[]> {
    return listPdfAnnotations(pdfFileId);
  }

  createAnnotation: typeof createPdfAnnotation = createPdfAnnotation;

  updateAnnotation(
    annotationId: string,
    patch: Partial<PdfAnnotationRecord>,
  ): Promise<PdfAnnotationRecord | null> {
    return updatePdfAnnotation(annotationId, patch);
  }

  deleteAnnotation(annotationId: string): Promise<void> {
    return deletePdfAnnotation(annotationId);
  }

  createCitation: typeof createPdfCitationFromSelection =
    createPdfCitationFromSelection;

  listCitations(pdfFileId: string): Promise<PdfCitationRecord[]> {
    return listPdfCitations(pdfFileId);
  }

  insertCitationIntoDocument(input: {
    citationId: string;
    insertedAtBlockId?: string;
  }) {
    return markCitationAsInserted(input);
  }

  async saveReferenceCandidate(candidate: PdfSourceCandidate) {
    await pdfReaderRepository.putReferenceCandidate(candidate);
    return candidate;
  }

  async createReferenceCandidateFromMetadata(input: {
    pdfFileId: string;
    metadata: {
      title?: string;
      author?: string;
      creationDate?: string;
      modificationDate?: string;
      possibleDoi?: string;
      possibleIsbn?: string;
      possibleInstitution?: string;
    };
  }) {
    const candidate = buildPdfSourceCandidate({
      pdfFileId: input.pdfFileId,
      metadata: input.metadata,
    });
    await pdfReaderRepository.putReferenceCandidate(candidate);
    return candidate;
  }

  persistPageGeoBlocks: typeof persistGeoTextBlocks = persistGeoTextBlocks;

  ensureTranslationLayerForPage: typeof ensureTranslationLayerForPage =
    ensureTranslationLayerForPage;

  listTranslationBlocks(pdfFileId: string): Promise<PdfTranslationBlockRecord[]> {
    return listTranslationBlocksForPdf(pdfFileId);
  }

  listTranslationBlocksByPage(
    pdfFileId: string,
    pageNumber: number,
  ): Promise<PdfTranslationBlockRecord[]> {
    return listTranslationBlocksForPage(pdfFileId, pageNumber);
  }

  updateTranslationBlockText: typeof updateTranslationBlockText =
    updateTranslationBlockText;

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
    return translatePageBlocks(input);
  }

  translateDocument(input: {
    pdfFileId: string;
    strategy: PdfTranslationStrategy;
    runtime?: PdfTranslationRuntime;
    preferredProviderId?: string;
    sourceLanguage?: string;
    targetLanguage: string;
    onlyPending?: boolean;
  }) {
    return translateDocumentBlocks(input);
  }

  getReaderPreferences(input: {
    projectId: string;
    documentId?: string;
  }): Promise<PdfReaderPreferencesRecord> {
    return loadOrCreateReaderPreferences(input);
  }

  updateReaderPreferences(input: {
    projectId: string;
    documentId?: string;
    patch: Partial<PdfReaderPreferencesRecord>;
  }): Promise<PdfReaderPreferencesRecord> {
    return updateReaderPreferences(input);
  }
}

export const pdfReaderService = new PdfReaderService();
