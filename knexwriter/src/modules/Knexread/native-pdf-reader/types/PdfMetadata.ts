export type PdfMetadataRecord = {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  producer?: string;
  creator?: string;
  creationDate?: string;
  modificationDate?: string;
  totalPages?: number;
  possibleDoi?: string;
  possibleIsbn?: string;
  possibleInstitution?: string;
};

export type PdfSourceCandidate = {
  pdfFileId: string;
  sourceCandidate: {
    title?: string;
    author?: string;
    year?: string;
    doi?: string;
    isbn?: string;
    institution?: string;
    sourceType: "pdf";
  };
  confidence: "high" | "medium" | "low";
  missingFields: string[];
  warnings: string[];
};

