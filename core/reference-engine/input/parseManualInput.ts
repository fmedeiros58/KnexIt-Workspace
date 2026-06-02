import type { BibliographicSource, DateParts, PageRange, PersonName } from "../core/BibliographicSource";
import type { ReferenceType } from "../core/ReferenceType";
import { detectReferenceType } from "../detectors/detectReferenceType";

type ManualInput = Partial<BibliographicSource> & {
  id?: string;
  type?: ReferenceType;
  authors?: PersonName[];
  publicationDate?: DateParts | string;
  accessDate?: DateParts | string;
  pages?: PageRange | string;
};

function buildId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `ref-${crypto.randomUUID()}`;
  }
  return `ref-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function parseManualInput(input: ManualInput): BibliographicSource {
  const detectedType = detectReferenceType(input);
  return {
    id: input.id || buildId(),
    type: input.type || detectedType,
    title: input.title?.trim() || "",
    style: input.style,
    authors: input.authors || [],
    organizationAuthor: input.organizationAuthor?.trim(),
    organizer: input.organizer?.trim(),
    editor: input.editor?.trim(),
    translator: input.translator?.trim(),
    subtitle: input.subtitle?.trim(),
    translatedTitle: input.translatedTitle?.trim(),
    containerTitle: input.containerTitle?.trim(),
    containerSubtitle: input.containerSubtitle?.trim(),
    edition: input.edition?.trim(),
    volume: input.volume?.trim(),
    issue: input.issue?.trim(),
    number: input.number?.trim(),
    series: input.series?.trim(),
    pages: typeof input.pages === "string" ? { raw: input.pages.trim() } : input.pages,
    place: input.place?.trim(),
    publisher: input.publisher?.trim(),
    institution: input.institution?.trim(),
    country: input.country?.trim(),
    language: input.language?.trim(),
    department: input.department?.trim(),
    program: input.program?.trim(),
    publicationDate:
      typeof input.publicationDate === "string"
        ? { raw: input.publicationDate.trim(), year: input.publicationDate.trim() }
        : input.publicationDate,
    depositDate: input.depositDate,
    accessDate:
      typeof input.accessDate === "string"
        ? { raw: input.accessDate.trim() }
        : input.accessDate,
    doi: input.doi?.trim(),
    isbn: input.isbn?.trim(),
    issn: input.issn?.trim(),
    url: input.url?.trim(),
    socialHandle: input.socialHandle?.trim(),
    digitalIdentifier: input.digitalIdentifier?.trim(),
    version: input.version?.trim(),
    platform: input.platform?.trim(),
    license: input.license?.trim(),
    databaseName: input.databaseName?.trim(),
    repositoryName: input.repositoryName?.trim(),
    academicWork: input.academicWork,
    legal: input.legal,
    media: input.media,
    event: input.event,
    referenceStatus: input.referenceStatus,
    contributors: input.contributors,
    sourceQuality: input.sourceQuality,
    rawInput: input.rawInput,
    summary: input.summary?.trim(),
    keywords: input.keywords,
    tags: input.tags,
    internalNotes: input.internalNotes?.trim(),
    attachments: input.attachments,
    extra: input.extra,
  };
}
