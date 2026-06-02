export const KNEX_PDF_ANNOTATION_TABLE = "knex_pdf_annotations";

export const KNEX_PDF_ANNOTATION_COLUMNS = {
  id: "id",
  documentId: "document_id",
  pageIndex: "page_index",
  type: "type",
  pdfRectsJson: "pdf_rects_json",
  styleJson: "style_json",
  content: "content",
  authorId: "author_id",
  metadataJson: "metadata_json",
  createdAt: "created_at",
  updatedAt: "updated_at",
} as const;

export type KnexPdfAnnotationColumn =
  (typeof KNEX_PDF_ANNOTATION_COLUMNS)[keyof typeof KNEX_PDF_ANNOTATION_COLUMNS];
