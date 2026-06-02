export const NATIVE_PDF_READER_DB_NAME = "knexwriter.knexread.v1";
export const NATIVE_PDF_READER_DB_VERSION = 2;

export const NATIVE_PDF_READER_STORES = {
  pdfFiles: "pdf_files",
  pdfFileBlobs: "pdf_file_blobs",
  sessions: "pdf_reader_sessions",
  highlights: "pdf_highlights",
  annotations: "pdf_annotations",
  citations: "pdf_citations",
  referenceCandidates: "pdf_reference_candidates",
  geoTextBlocks: "pdf_geo_text_blocks",
  translationBlocks: "pdf_translation_blocks",
  translationRevisions: "pdf_translation_revisions",
  readerPreferences: "pdf_reader_preferences",
} as const;
