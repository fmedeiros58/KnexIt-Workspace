export type PdfDocumentMetadata = {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  pageCount: number;
  fingerprint?: string;
};
