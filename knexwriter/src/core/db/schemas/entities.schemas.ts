import type { EntitySchema } from "./schema.types";

const baseFields = [
  { name: "id", type: "uuid", nullable: false, indexed: true, unique: true },
  { name: "createdAt", type: "timestamp", nullable: false, indexed: true },
  { name: "updatedAt", type: "timestamp", nullable: false, indexed: true },
  { name: "deletedAt", type: "timestamp", nullable: true, indexed: true },
  { name: "syncStatus", type: "text", nullable: false, indexed: true },
  { name: "remoteId", type: "text", nullable: true, indexed: true },
  { name: "version", type: "integer", nullable: false, defaultValue: "1" },
  { name: "lastSyncedAt", type: "timestamp", nullable: true, indexed: true },
  { name: "deviceId", type: "text", nullable: true, indexed: true },
] as const;

export const projectSchema: EntitySchema = {
  name: "Project",
  tableName: "projects",
  fields: [
    ...baseFields,
    { name: "name", type: "text", nullable: false },
    { name: "description", type: "text", nullable: true },
    { name: "ownerId", type: "text", nullable: true, indexed: true },
    { name: "status", type: "text", nullable: false, indexed: true },
    { name: "metadataJson", type: "json", nullable: true },
  ],
};

export const documentSchema: EntitySchema = {
  name: "Document",
  tableName: "documents",
  fields: [
    ...baseFields,
    { name: "projectId", type: "uuid", nullable: false, indexed: true },
    { name: "title", type: "text", nullable: false, indexed: true },
    { name: "contentJson", type: "json", nullable: true },
    { name: "contentHtml", type: "text", nullable: true },
    { name: "contentPlainText", type: "text", nullable: true },
    { name: "citationStyle", type: "text", nullable: false, indexed: true },
    { name: "bibliographyStyle", type: "text", nullable: false, indexed: true },
    { name: "lastOpenedAt", type: "timestamp", nullable: true, indexed: true },
  ],
};

export const fileAssetSchema: EntitySchema = {
  name: "FileAsset",
  tableName: "file_assets",
  fields: [
    ...baseFields,
    { name: "originalFileName", type: "text", nullable: false },
    { name: "storedFileName", type: "text", nullable: true },
    { name: "mimeType", type: "text", nullable: true, indexed: true },
    { name: "sizeBytes", type: "integer", nullable: true },
    { name: "storageProvider", type: "text", nullable: false, indexed: true },
    { name: "localPath", type: "text", nullable: true },
    { name: "remotePath", type: "text", nullable: true },
    { name: "storageKey", type: "text", nullable: true, indexed: true },
    { name: "sha256", type: "text", nullable: true, indexed: true },
    { name: "ocrStatus", type: "text", nullable: false, indexed: true },
    { name: "textExtractionStatus", type: "text", nullable: false, indexed: true },
    { name: "metadataJson", type: "json", nullable: true },
  ],
};

export const referenceSourceSchema: EntitySchema = {
  name: "ReferenceSource",
  tableName: "reference_sources",
  fields: [
    ...baseFields,
    { name: "projectId", type: "uuid", nullable: false, indexed: true },
    { name: "type", type: "text", nullable: false, indexed: true },
    { name: "title", type: "text", nullable: false, indexed: true },
    { name: "subtitle", type: "text", nullable: true },
    { name: "year", type: "text", nullable: true, indexed: true },
    { name: "doi", type: "text", nullable: true, indexed: true },
    { name: "isbn", type: "text", nullable: true, indexed: true },
    { name: "issn", type: "text", nullable: true, indexed: true },
    { name: "url", type: "text", nullable: true, indexed: true },
    { name: "reliabilityLevel", type: "text", nullable: false, indexed: true },
    { name: "includeAsConsultedWork", type: "boolean", nullable: false, defaultValue: "false" },
    { name: "status", type: "text", nullable: false, indexed: true },
    { name: "styleMetadataJson", type: "json", nullable: true },
  ],
};

export const citationOccurrenceSchema: EntitySchema = {
  name: "CitationOccurrence",
  tableName: "citation_occurrences",
  fields: [
    ...baseFields,
    { name: "projectId", type: "uuid", nullable: false, indexed: true },
    { name: "documentId", type: "uuid", nullable: false, indexed: true },
    { name: "referenceSourceId", type: "uuid", nullable: false, indexed: true },
    { name: "citationType", type: "text", nullable: false, indexed: true },
    { name: "citationMode", type: "text", nullable: false, indexed: true },
    { name: "citationText", type: "text", nullable: true },
    { name: "quotedText", type: "text", nullable: true },
    { name: "paraphraseText", type: "text", nullable: true },
    { name: "page", type: "text", nullable: true },
    { name: "pageStart", type: "text", nullable: true },
    { name: "pageEnd", type: "text", nullable: true },
    { name: "status", type: "text", nullable: false, indexed: true },
  ],
};

export const generatedBibliographyEntrySchema: EntitySchema = {
  name: "GeneratedBibliographyEntry",
  tableName: "generated_bibliography_entries",
  fields: [
    ...baseFields,
    { name: "projectId", type: "uuid", nullable: false, indexed: true },
    { name: "documentId", type: "uuid", nullable: false, indexed: true },
    { name: "referenceSourceId", type: "uuid", nullable: false, indexed: true },
    { name: "style", type: "text", nullable: false, indexed: true },
    { name: "formattedText", type: "text", nullable: false },
    { name: "formattedHtml", type: "text", nullable: true },
    { name: "sortKey", type: "text", nullable: false, indexed: true },
    { name: "isIncluded", type: "boolean", nullable: false, defaultValue: "true" },
    { name: "generatedFromVersion", type: "integer", nullable: false, defaultValue: "1" },
  ],
};

export const projectFileSchema: EntitySchema = {
  name: "ProjectFile",
  tableName: "project_files",
  fields: [
    ...baseFields,
    { name: "projectId", type: "uuid", nullable: false, indexed: true },
    { name: "documentId", type: "uuid", nullable: true, indexed: true },
    { name: "fileAssetId", type: "uuid", nullable: false, indexed: true },
    { name: "label", type: "text", nullable: true },
    { name: "description", type: "text", nullable: true },
    { name: "sourceType", type: "text", nullable: false, indexed: true },
    { name: "isPrimary", type: "boolean", nullable: false, defaultValue: "false" },
  ],
};

export const referenceAuthorSchema: EntitySchema = {
  name: "ReferenceAuthor",
  tableName: "reference_authors",
  fields: [
    ...baseFields,
    { name: "referenceSourceId", type: "uuid", nullable: false, indexed: true },
    { name: "personName", type: "text", nullable: true },
    { name: "familyName", type: "text", nullable: true, indexed: true },
    { name: "givenName", type: "text", nullable: true },
    { name: "institutionName", type: "text", nullable: true },
    { name: "responsibilityType", type: "text", nullable: false, indexed: true },
    { name: "authorOrder", type: "integer", nullable: true },
    { name: "orcid", type: "text", nullable: true, indexed: true },
    { name: "normalizedAbnt", type: "text", nullable: true },
    { name: "normalizedApa", type: "text", nullable: true },
  ],
};

export const referenceAttachmentSchema: EntitySchema = {
  name: "ReferenceAttachment",
  tableName: "reference_attachments",
  fields: [
    ...baseFields,
    { name: "referenceSourceId", type: "uuid", nullable: false, indexed: true },
    { name: "fileAssetId", type: "uuid", nullable: false, indexed: true },
    { name: "projectFileId", type: "uuid", nullable: true, indexed: true },
    { name: "attachmentType", type: "text", nullable: false, indexed: true },
    { name: "isMainSource", type: "boolean", nullable: false, defaultValue: "false" },
    { name: "description", type: "text", nullable: true },
  ],
};

export const citationLocatorSchema: EntitySchema = {
  name: "CitationLocator",
  tableName: "citation_locators",
  fields: [
    ...baseFields,
    { name: "citationOccurrenceId", type: "uuid", nullable: false, indexed: true },
    { name: "fileAssetId", type: "uuid", nullable: true, indexed: true },
    { name: "referenceAttachmentId", type: "uuid", nullable: true, indexed: true },
    { name: "pdfAnnotationId", type: "uuid", nullable: true, indexed: true },
    { name: "pageNumber", type: "integer", nullable: true, indexed: true },
    { name: "pageLabel", type: "text", nullable: true },
    { name: "textBefore", type: "text", nullable: true },
    { name: "matchedText", type: "text", nullable: true },
    { name: "textAfter", type: "text", nullable: true },
    { name: "rectsJson", type: "json", nullable: true },
    { name: "charStart", type: "integer", nullable: true },
    { name: "charEnd", type: "integer", nullable: true },
    { name: "confidence", type: "float", nullable: true },
    { name: "locatorType", type: "text", nullable: false, indexed: true },
    { name: "status", type: "text", nullable: false, indexed: true },
  ],
};

export const documentCitationLinkSchema: EntitySchema = {
  name: "DocumentCitationLink",
  tableName: "document_citation_links",
  fields: [
    ...baseFields,
    { name: "documentId", type: "uuid", nullable: false, indexed: true },
    { name: "citationOccurrenceId", type: "uuid", nullable: false, indexed: true },
    { name: "editorNodeId", type: "text", nullable: true, indexed: true },
    { name: "fromPosition", type: "integer", nullable: true },
    { name: "toPosition", type: "integer", nullable: true },
    { name: "displayText", type: "text", nullable: true },
    { name: "href", type: "text", nullable: false },
  ],
};

export const pdfAnnotationSchema: EntitySchema = {
  name: "PdfAnnotation",
  tableName: "pdf_annotations",
  fields: [
    ...baseFields,
    { name: "projectId", type: "uuid", nullable: false, indexed: true },
    { name: "documentId", type: "uuid", nullable: true, indexed: true },
    { name: "fileAssetId", type: "uuid", nullable: false, indexed: true },
    { name: "pageNumber", type: "integer", nullable: true, indexed: true },
    { name: "pageLabel", type: "text", nullable: true },
    { name: "annotationType", type: "text", nullable: false, indexed: true },
    { name: "selectedText", type: "text", nullable: true },
    { name: "textBefore", type: "text", nullable: true },
    { name: "textAfter", type: "text", nullable: true },
    { name: "rectsJson", type: "json", nullable: true },
    { name: "color", type: "text", nullable: true },
    { name: "comment", type: "text", nullable: true },
    { name: "createdBy", type: "text", nullable: true },
    { name: "status", type: "text", nullable: false, indexed: true },
  ],
};

export const pdfAnchorSchema: EntitySchema = {
  name: "PdfAnchor",
  tableName: "pdf_anchors",
  fields: [
    ...baseFields,
    { name: "projectId", type: "uuid", nullable: false, indexed: true },
    { name: "fileAssetId", type: "uuid", nullable: false, indexed: true },
    { name: "pdfAnnotationId", type: "uuid", nullable: true, indexed: true },
    { name: "anchorType", type: "text", nullable: false, indexed: true },
    { name: "pageNumber", type: "integer", nullable: true, indexed: true },
    { name: "pageLabel", type: "text", nullable: true },
    { name: "selectedText", type: "text", nullable: true },
    { name: "rectsJson", type: "json", nullable: true },
    { name: "textBefore", type: "text", nullable: true },
    { name: "textAfter", type: "text", nullable: true },
    { name: "confidence", type: "float", nullable: true },
  ],
};

export const fileTextIndexSchema: EntitySchema = {
  name: "FileTextIndex",
  tableName: "file_text_index",
  fields: [
    ...baseFields,
    { name: "projectId", type: "uuid", nullable: false, indexed: true },
    { name: "fileAssetId", type: "uuid", nullable: false, indexed: true },
    { name: "pageNumber", type: "integer", nullable: true, indexed: true },
    { name: "pageLabel", type: "text", nullable: true },
    { name: "chunkIndex", type: "integer", nullable: false, indexed: true },
    { name: "content", type: "text", nullable: false },
    { name: "contentNormalized", type: "text", nullable: true },
    { name: "language", type: "text", nullable: true },
    { name: "extractionMethod", type: "text", nullable: false, indexed: true },
    { name: "searchVector", type: "text", nullable: true },
  ],
};

export const fileEmbeddingIndexSchema: EntitySchema = {
  name: "FileEmbeddingIndex",
  tableName: "file_embedding_index",
  fields: [
    ...baseFields,
    { name: "projectId", type: "uuid", nullable: false, indexed: true },
    { name: "fileAssetId", type: "uuid", nullable: false, indexed: true },
    { name: "pageNumber", type: "integer", nullable: true, indexed: true },
    { name: "chunkIndex", type: "integer", nullable: false, indexed: true },
    { name: "content", type: "text", nullable: false },
    { name: "embedding", type: "json", nullable: true },
    { name: "model", type: "text", nullable: true },
  ],
};

export const referenceNoteSchema: EntitySchema = {
  name: "ReferenceNote",
  tableName: "reference_notes",
  fields: [
    ...baseFields,
    { name: "projectId", type: "uuid", nullable: false, indexed: true },
    { name: "documentId", type: "uuid", nullable: true, indexed: true },
    { name: "referenceSourceId", type: "uuid", nullable: true, indexed: true },
    { name: "citationOccurrenceId", type: "uuid", nullable: true, indexed: true },
    { name: "title", type: "text", nullable: true },
    { name: "noteType", type: "text", nullable: false, indexed: true },
    { name: "content", type: "text", nullable: false },
  ],
};

export const referenceTagSchema: EntitySchema = {
  name: "ReferenceTag",
  tableName: "reference_tags",
  fields: [
    ...baseFields,
    { name: "projectId", type: "uuid", nullable: false, indexed: true },
    { name: "name", type: "text", nullable: false, indexed: true },
    { name: "color", type: "text", nullable: true },
  ],
};

export const referenceSourceTagSchema: EntitySchema = {
  name: "ReferenceSourceTag",
  tableName: "reference_source_tags",
  fields: [
    ...baseFields,
    { name: "referenceSourceId", type: "uuid", nullable: false, indexed: true },
    { name: "referenceTagId", type: "uuid", nullable: false, indexed: true },
  ],
};

export const fileAssetTagSchema: EntitySchema = {
  name: "FileAssetTag",
  tableName: "file_asset_tags",
  fields: [
    ...baseFields,
    { name: "fileAssetId", type: "uuid", nullable: false, indexed: true },
    { name: "referenceTagId", type: "uuid", nullable: false, indexed: true },
  ],
};

export const syncChangeLogSchema: EntitySchema = {
  name: "SyncChangeLog",
  tableName: "sync_change_logs",
  fields: [
    ...baseFields,
    { name: "entityName", type: "text", nullable: false, indexed: true },
    { name: "entityId", type: "uuid", nullable: false, indexed: true },
    { name: "projectId", type: "uuid", nullable: true, indexed: true },
    { name: "operation", type: "text", nullable: false, indexed: true },
    { name: "payloadJson", type: "json", nullable: true },
    { name: "processedAt", type: "timestamp", nullable: true, indexed: true },
    { name: "errorMessage", type: "text", nullable: true },
  ],
};

export const deviceRegistrySchema: EntitySchema = {
  name: "DeviceRegistry",
  tableName: "device_registry",
  fields: [
    ...baseFields,
    { name: "deviceName", type: "text", nullable: false },
    { name: "deviceType", type: "text", nullable: false, indexed: true },
    { name: "installationId", type: "text", nullable: false, indexed: true, unique: true },
    { name: "lastSeenAt", type: "timestamp", nullable: true, indexed: true },
    { name: "syncEnabled", type: "boolean", nullable: false, defaultValue: "false" },
  ],
};

export const allEntitySchemas: EntitySchema[] = [
  projectSchema,
  documentSchema,
  fileAssetSchema,
  projectFileSchema,
  referenceSourceSchema,
  referenceAuthorSchema,
  referenceAttachmentSchema,
  citationOccurrenceSchema,
  citationLocatorSchema,
  documentCitationLinkSchema,
  pdfAnnotationSchema,
  pdfAnchorSchema,
  fileTextIndexSchema,
  fileEmbeddingIndexSchema,
  referenceNoteSchema,
  referenceTagSchema,
  referenceSourceTagSchema,
  fileAssetTagSchema,
  generatedBibliographyEntrySchema,
  syncChangeLogSchema,
  deviceRegistrySchema,
];
