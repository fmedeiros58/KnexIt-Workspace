import type { ReferenceStyle } from "./ReferenceStyle";
import type { ReferenceType } from "./ReferenceType";

export type SourceReliability =
  | "scientific"
  | "institutional"
  | "journalistic"
  | "legal"
  | "informal"
  | "unverified"
  | "technical"
  | "governmental"
  | "academic"
  | "audiovisual"
  | "other";

export type ReferenceAuthorRole =
  | "author"
  | "editor"
  | "organizer"
  | "translator"
  | "director"
  | "producer"
  | "coordinator"
  | "institution";

export type PersonName = {
  givenNames?: string;
  familyName?: string;
  suffix?: string;
  literal?: string;
  role?: ReferenceAuthorRole;
  order?: number;
  orcid?: string;
};

export type DateParts = {
  year?: string;
  month?: string;
  day?: string;
  raw?: string;
};

export type PageRange = {
  start?: string;
  end?: string;
  raw?: string;
};

export type BibliographicSource = {
  id: string;

  type: ReferenceType;
  style?: ReferenceStyle;

  authors?: PersonName[];
  organizationAuthor?: string;
  organizer?: string;
  editor?: string;
  translator?: string;

  title: string;
  subtitle?: string;
  translatedTitle?: string;

  containerTitle?: string;
  containerSubtitle?: string;

  edition?: string;
  volume?: string;
  issue?: string;
  number?: string;
  series?: string;

  pages?: PageRange;

  place?: string;
  publisher?: string;
  institution?: string;
  country?: string;
  language?: string;
  department?: string;
  program?: string;

  publicationDate?: DateParts;
  depositDate?: DateParts;
  accessDate?: DateParts;

  doi?: string;
  isbn?: string;
  issn?: string;
  url?: string;
  socialHandle?: string;
  digitalIdentifier?: string;
  version?: string;
  platform?: string;
  license?: string;

  databaseName?: string;
  repositoryName?: string;

  academicWork?: {
    workType?: "TCC" | "monografia" | "dissertação" | "tese" | "artigo de conclusão";
    degree?: string;
    course?: string;
    institution?: string;
    place?: string;
    advisor?: string;
    coAdvisor?: string;
    pageCount?: string;
  };

  legal?: {
    jurisdiction?: string;
    lawNumber?: string;
    lawDate?: DateParts;
    normativeType?: string;
    summary?: string;
    status?: "vigente" | "revogada" | "alterada" | "consolidada" | "nao_verificada";
    emittingBody?: string;
    officialGazette?: string;
    section?: string;
    page?: string;
  };

  media?: {
    duration?: string;
    timestampStart?: string;
    timestampEnd?: string;
    transcript?: string;
    transcriptBy?: string;
    materialType?: "aula" | "palestra" | "conferencia" | "video" | "webinario" | "live";
  };

  event?: {
    eventTitle?: string;
    eventEdition?: string;
    eventLocation?: string;
    eventDate?: DateParts;
    promoterInstitution?: string;
    proceedingsTitle?: string;
  };

  referenceStatus?: {
    isCitedInDocument?: boolean;
    isInReferenceList?: boolean;
    duplicateOfSourceId?: string;
    version?: number;
  };

  contributors?: {
    editors?: PersonName[];
    organizers?: PersonName[];
    translators?: PersonName[];
    advisors?: PersonName[];
  };

  sourceQuality?: {
    confidence: "high" | "medium" | "low";
    reliability?: SourceReliability;
    missingFields: string[];
    warnings: string[];
    origin:
      | "manual"
      | "doi"
      | "isbn"
      | "url"
      | "bibtex"
      | "ris"
      | "crossref"
      | "datacite"
      | "metadata";
  };

  rawInput?: string;
  summary?: string;
  keywords?: string[];
  tags?: string[];
  internalNotes?: string;
  attachments?: Array<{
    id: string;
    name: string;
    mimeType?: string;
    url?: string;
    sourceId?: string;
  }>;
  extra?: Record<string, string>;
};

