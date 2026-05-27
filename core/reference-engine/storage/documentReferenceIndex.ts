import type { BibliographicSource } from "../core/BibliographicSource";
import type {
  CitationCallFormat,
  CitationOccurrenceType,
  CitationOutput,
} from "../citations/citationTypes";
import type { ReferenceStyle } from "../core/ReferenceStyle";
import type { ReferenceTypographyConfig } from "../utils/typography";

export type CitationInstance = {
  id: string;
  documentId: string;
  sourceId: string;
  style: ReferenceStyle;
  citationText: string;
  occurrenceType?: CitationOccurrenceType;
  callFormat?: CitationCallFormat;
  page?: string;
  pageEnd?: string;
  chapter?: string;
  section?: string;
  paragraph?: string;
  timestampStart?: string;
  timestampEnd?: string;
  literalExcerpt?: string;
  paraphrasedExcerpt?: string;
  authorComment?: string;
  footnoteText?: string;
  isCitationInText?: boolean;
  generateReferenceEntry?: boolean;
  locator?: {
    type: "page" | "paragraph" | "section" | "chapter";
    value: string;
  };
  insertedAtBlockId?: string;
};

export type DocumentReferenceMemory = {
  documentId: string;
  references: BibliographicSource[];
  citations: CitationInstance[];
  attachments?: Array<{
    id: string;
    sourceId: string;
    name: string;
    mimeType?: string;
    url?: string;
  }>;
  notes?: Array<{
    id: string;
    sourceId?: string;
    content: string;
  }>;
  tags?: Array<{
    id: string;
    sourceId?: string;
    label: string;
  }>;
  selectedStyle: ReferenceStyle;
  typographyConfig: ReferenceTypographyConfig;
};

export function createDocumentReferenceMemory(documentId: string, style: ReferenceStyle): DocumentReferenceMemory {
  return {
    documentId,
    references: [],
    citations: [],
    attachments: [],
    notes: [],
    tags: [],
    selectedStyle: style,
    typographyConfig: {
      abntTitleEmphasis: "none",
    },
  };
}

export function citationOutputToInstance(
  documentId: string,
  output: CitationOutput,
  locator?: CitationInstance["locator"],
  overrides?: Partial<CitationInstance>,
): CitationInstance {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? `citation-${crypto.randomUUID()}`
      : `citation-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    ...overrides,
    id,
    documentId,
    sourceId: output.sourceId,
    style: output.style,
    citationText: output.citation,
    locator,
  };
}
