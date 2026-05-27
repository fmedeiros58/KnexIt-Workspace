import type {
  PdfAnnotationRecord,
  PdfCitationRecord,
  PdfDocumentSource,
  PdfGeoTextBlockRecord,
  PdfHighlightRecord,
  PdfReaderPreferencesRecord,
  PdfReaderSessionRecord,
  PdfSourceCandidate,
  PdfTranslationBlockRecord,
  PdfTranslationRevisionRecord,
} from "../types";

export type PdfFileRecord = PdfDocumentSource;

export type PdfReaderSessionStoreRecord = PdfReaderSessionRecord;

export type PdfHighlightStoreRecord = PdfHighlightRecord;

export type PdfAnnotationStoreRecord = PdfAnnotationRecord;

export type PdfCitationStoreRecord = PdfCitationRecord;

export type PdfReferenceCandidateStoreRecord = PdfSourceCandidate;

export type PdfFileBlobRecord = {
  pdfFileId: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
  updatedAt: string;
};

export type PdfGeoTextStoreRecord = PdfGeoTextBlockRecord;

export type PdfTranslationBlockStoreRecord = PdfTranslationBlockRecord;

export type PdfTranslationRevisionStoreRecord = PdfTranslationRevisionRecord;

export type PdfReaderPreferencesStoreRecord = PdfReaderPreferencesRecord;
