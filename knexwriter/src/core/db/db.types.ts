export type UUID = string;
export type TimestampISO = string;

export type CitationStyle = "ABNT" | "APA" | "other";
export type BibliographyStyle = CitationStyle;

export type SyncStatus =
  | "local_only"
  | "synced"
  | "updated_locally"
  | "updated_remotely"
  | "deleted_locally"
  | "deleted_remotely"
  | "conflict"
  | "sync_error";

export type ReliabilityLevel =
  | "scientific"
  | "academic"
  | "institutional"
  | "governmental"
  | "legal"
  | "technical"
  | "journalistic"
  | "audiovisual"
  | "informal"
  | "unverified"
  | "other";

export type ReferenceSourceType =
  | "book_print"
  | "ebook"
  | "book_chapter"
  | "journal_article"
  | "newspaper_article"
  | "conference_paper"
  | "conference_abstract"
  | "thesis"
  | "dissertation"
  | "tcc_monograph"
  | "technical_report"
  | "institutional_report"
  | "government_document"
  | "legislation"
  | "constitution"
  | "law"
  | "decree"
  | "ordinance"
  | "resolution"
  | "normative_instruction"
  | "public_notice"
  | "technical_standard"
  | "patent"
  | "map"
  | "image"
  | "online_video"
  | "lecture"
  | "podcast"
  | "interview"
  | "dictionary_entry"
  | "webpage"
  | "social_media_post"
  | "dataset"
  | "software"
  | "preprint"
  | "unpublished_document"
  | "teaching_material"
  | "slides"
  | "case_law";

export type EntityStatus = "active" | "archived" | "deleted" | "needs_review";

export type StorageProvider =
  | "opfs"
  | "desktop_filesystem"
  | "cloud_storage"
  | "onedrive"
  | "google_drive"
  | "s3"
  | "r2"
  | "azure_blob"
  | "local_dev"
  | "unknown";

export type OcrStatus = "pending" | "processing" | "done" | "failed" | "not_required";
export type TextExtractionStatus = "pending" | "processing" | "done" | "failed" | "not_supported";

export type ProjectFileSourceType =
  | "pdf"
  | "image"
  | "docx"
  | "transcription"
  | "spreadsheet"
  | "audio"
  | "video"
  | "webpage"
  | "print"
  | "legal_document"
  | "report"
  | "article"
  | "book"
  | "dataset"
  | "other";

export type ReferenceSourceStatus =
  | "complete"
  | "incomplete"
  | "needs_review"
  | "duplicated"
  | "manual"
  | "imported"
  | "orphaned"
  | "deleted";

export type ResponsibilityType =
  | "author"
  | "institutional_author"
  | "organizer"
  | "editor"
  | "translator"
  | "coordinator"
  | "speaker"
  | "presenter"
  | "interviewer"
  | "interviewee"
  | "government_body"
  | "court"
  | "publisher_body"
  | "other";

export type AttachmentType =
  | "main_pdf"
  | "supporting_pdf"
  | "transcription"
  | "image"
  | "print"
  | "cover"
  | "dataset"
  | "audio"
  | "video"
  | "webpage_capture"
  | "legal_copy"
  | "manual_attachment"
  | "other";

export type CitationType =
  | "direct_short"
  | "direct_long"
  | "indirect"
  | "apud"
  | "paraphrase"
  | "narrative"
  | "parenthetical"
  | "footnote"
  | "summary"
  | "commented_citation";

export type CitationMode = "author_date" | "numeric" | "footnote" | "manual";

export type CitationStatus = "active" | "unused" | "orphaned" | "broken_locator" | "pending_review" | "deleted";

export type LocatorType =
  | "page_only"
  | "text_match"
  | "pdf_rect"
  | "ocr_match"
  | "timestamp"
  | "manual_anchor"
  | "paragraph_anchor";

export type LocatorStatus = "valid" | "needs_review" | "file_missing" | "page_not_found" | "text_not_found" | "manual" | "deleted";

export type AnnotationType =
  | "highlight"
  | "underline"
  | "strike"
  | "comment"
  | "note"
  | "bookmark"
  | "area"
  | "freehand"
  | "citation_anchor"
  | "reference_anchor"
  | "manual_anchor";

export type AnnotationStatus =
  | "active"
  | "linked_to_citation"
  | "linked_to_reference"
  | "unlinked"
  | "needs_review"
  | "deleted";

export type AnchorType = "manual" | "selection" | "citation" | "reference" | "bookmark" | "search_result";

export type ExtractionMethod =
  | "pdf_text_layer"
  | "ocr"
  | "docx_parser"
  | "html_parser"
  | "manual_transcription"
  | "audio_transcription"
  | "unknown";

export type ReferenceNoteType =
  | "summary"
  | "critical_note"
  | "methodological_note"
  | "quote_comment"
  | "chapter_relation"
  | "reading_note"
  | "manual_note"
  | "validation_note"
  | "source_check";

export type SyncOperation = "create" | "update" | "delete" | "restore";
export type DeviceType = "pwa" | "desktop" | "web" | "mobile" | "unknown";

export type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue };

export interface BaseEntity {
  id: UUID;
  createdAt: TimestampISO;
  updatedAt: TimestampISO;
  deletedAt?: TimestampISO | null;
  syncStatus: SyncStatus;
  remoteId?: string | null;
  version: number;
  lastSyncedAt?: TimestampISO | null;
  deviceId?: string | null;
}

export interface Project extends BaseEntity {
  name: string;
  description?: string;
  ownerId?: string;
  status: EntityStatus;
  metadataJson?: JSONValue;
}

export interface Document extends BaseEntity {
  projectId: UUID;
  title: string;
  contentJson?: JSONValue;
  contentHtml?: string;
  contentPlainText?: string;
  stylePreset?: string;
  citationStyle: CitationStyle;
  bibliographyStyle: BibliographyStyle;
  lastOpenedAt?: TimestampISO | null;
  metadataJson?: JSONValue;
}

export interface FileAsset extends BaseEntity {
  originalFileName: string;
  storedFileName?: string;
  mimeType?: string;
  extension?: string;
  sizeBytes?: number;
  storageProvider: StorageProvider;
  localPath?: string;
  remotePath?: string;
  storageKey?: string;
  checksum?: string;
  sha256?: string;
  uploadedBy?: string;
  pageCount?: number;
  durationSeconds?: number;
  ocrStatus: OcrStatus;
  textExtractionStatus: TextExtractionStatus;
  metadataJson?: JSONValue;
}

export interface ProjectFile extends BaseEntity {
  projectId: UUID;
  documentId?: UUID;
  fileAssetId: UUID;
  label?: string;
  description?: string;
  sourceType: ProjectFileSourceType;
  isPrimary: boolean;
}

export interface ReferenceSource extends BaseEntity {
  projectId: UUID;
  type: ReferenceSourceType;
  title: string;
  subtitle?: string;
  year?: string;
  date?: string;
  language?: string;
  country?: string;
  place?: string;
  publisher?: string;
  institution?: string;
  journalName?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  isbn?: string;
  issn?: string;
  url?: string;
  accessDate?: string;
  edition?: string;
  series?: string;
  abstract?: string;
  keywords?: string;
  reliabilityLevel: ReliabilityLevel;
  includeAsConsultedWork: boolean;
  status: ReferenceSourceStatus;
  styleMetadataJson?: JSONValue;
}

export interface ReferenceAuthor extends BaseEntity {
  referenceSourceId: UUID;
  personName?: string;
  familyName?: string;
  givenName?: string;
  institutionName?: string;
  responsibilityType: ResponsibilityType;
  authorOrder?: number;
  orcid?: string;
  normalizedAbnt?: string;
  normalizedApa?: string;
}

export interface ReferenceAttachment extends BaseEntity {
  referenceSourceId: UUID;
  fileAssetId: UUID;
  projectFileId?: UUID;
  attachmentType: AttachmentType;
  isMainSource: boolean;
  description?: string;
}

export interface CitationOccurrence extends BaseEntity {
  projectId: UUID;
  documentId: UUID;
  referenceSourceId: UUID;
  citationType: CitationType;
  citationMode: CitationMode;
  citationText?: string;
  quotedText?: string;
  paraphraseText?: string;
  authorComment?: string;
  page?: string;
  pageStart?: string;
  pageEnd?: string;
  chapter?: string;
  section?: string;
  paragraph?: string;
  timestampStart?: string;
  timestampEnd?: string;
  status: CitationStatus;
}

export interface CitationLocator extends BaseEntity {
  citationOccurrenceId: UUID;
  fileAssetId?: UUID;
  referenceAttachmentId?: UUID;
  pdfAnnotationId?: UUID;
  pageNumber?: number;
  pageLabel?: string;
  textBefore?: string;
  matchedText?: string;
  textAfter?: string;
  rectsJson?: JSONValue;
  charStart?: number;
  charEnd?: number;
  confidence?: number;
  locatorType: LocatorType;
  status: LocatorStatus;
}

export interface DocumentCitationLink extends BaseEntity {
  documentId: UUID;
  citationOccurrenceId: UUID;
  editorNodeId?: string;
  fromPosition?: number;
  toPosition?: number;
  displayText?: string;
  href: string;
}

export interface PdfAnnotation extends BaseEntity {
  projectId: UUID;
  documentId?: UUID;
  fileAssetId: UUID;
  pageNumber?: number;
  pageLabel?: string;
  annotationType: AnnotationType;
  selectedText?: string;
  textBefore?: string;
  textAfter?: string;
  rectsJson?: JSONValue;
  color?: string;
  comment?: string;
  createdBy?: string;
  status: AnnotationStatus;
}

export interface PdfAnchor extends BaseEntity {
  projectId: UUID;
  fileAssetId: UUID;
  pdfAnnotationId?: UUID;
  anchorType: AnchorType;
  pageNumber?: number;
  pageLabel?: string;
  selectedText?: string;
  rectsJson?: JSONValue;
  textBefore?: string;
  textAfter?: string;
  confidence?: number;
}

export interface FileTextIndex extends BaseEntity {
  projectId: UUID;
  fileAssetId: UUID;
  pageNumber?: number;
  pageLabel?: string;
  chunkIndex: number;
  content: string;
  contentNormalized?: string;
  language?: string;
  extractionMethod: ExtractionMethod;
  searchVector?: string;
}

export interface FileEmbeddingIndex extends BaseEntity {
  projectId: UUID;
  fileAssetId: UUID;
  pageNumber?: number;
  chunkIndex: number;
  content: string;
  embedding?: number[];
  model?: string;
}

export interface ReferenceNote extends BaseEntity {
  projectId: UUID;
  documentId?: UUID;
  referenceSourceId?: UUID;
  citationOccurrenceId?: UUID;
  title?: string;
  noteType: ReferenceNoteType;
  content: string;
}

export interface ReferenceTag extends BaseEntity {
  projectId: UUID;
  name: string;
  color?: string;
}

export interface ReferenceSourceTag extends BaseEntity {
  referenceSourceId: UUID;
  referenceTagId: UUID;
}

export interface FileAssetTag extends BaseEntity {
  fileAssetId: UUID;
  referenceTagId: UUID;
}

export interface GeneratedBibliographyEntry extends BaseEntity {
  projectId: UUID;
  documentId: UUID;
  referenceSourceId: UUID;
  style: BibliographyStyle;
  formattedText: string;
  formattedHtml?: string;
  sortKey: string;
  isIncluded: boolean;
  generatedFromVersion: number;
}

export interface SyncChangeLog extends BaseEntity {
  entityName: string;
  entityId: UUID;
  projectId?: UUID;
  operation: SyncOperation;
  payloadJson?: JSONValue;
  processedAt?: TimestampISO | null;
  errorMessage?: string;
}

export interface DeviceRegistry extends BaseEntity {
  deviceName: string;
  deviceType: DeviceType;
  installationId: string;
  lastSeenAt?: TimestampISO | null;
  syncEnabled: boolean;
}

export interface CitationNodeAttrs {
  citationOccurrenceId: UUID;
  referenceSourceId: UUID;
  displayText: string;
  href: string;
}

export interface ValidationIssue {
  code: string;
  message: string;
  entityName: string;
  entityId?: UUID;
  severity: "info" | "warning" | "error";
}

