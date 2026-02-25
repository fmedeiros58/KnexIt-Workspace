import type { DocumentKind } from "./types";

export const SUPPORTED_DOCUMENT_KIND: DocumentKind = "pdf";

export const DEFAULT_SOURCE_LANGUAGE = "en";
export const DEFAULT_TARGET_LANGUAGE = "pt";

export const PDF_RENDER_SCALE = 1.35;
export const PAGE_TEXT_PADDING = 2;
export const PAGE_LINE_MERGE_TOLERANCE = 4;

export const TRANSLATION_CACHE_TTL_MS = 1000 * 60 * 60 * 8;

export const MAX_TRANSLATION_BLOCKS_PER_REQUEST = 400;

export const OPEN_PDF_PICKER_EVENT = "vioread:open-pdf-picker";

export const RECENT_DOCUMENTS_STORAGE_KEY = "vioread:recent-documents";
export const RECENT_DOCUMENTS_VERSION_KEY = "vioread:recent-documents:version";
export const RECENT_DOCUMENTS_VERSION = "2026-02-26-real-history-v1";
export const MAX_RECENT_DOCUMENTS = 30;

