import type { PdfMetadataRecord } from "./PdfMetadata";

export type PdfDocumentSource = {
  id: string;
  projectId: string;
  documentId?: string;
  sourceId?: string;
  fileName: string;
  filePath: string;
  mimeType: "application/pdf";
  fileSize?: number;
  fingerprint?: string;
  checksum?: string;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  producer?: string;
  creator?: string;
  creationDate?: string;
  modificationDate?: string;
  metadata?: PdfMetadataRecord;
  totalPages?: number;
  addedAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
};
