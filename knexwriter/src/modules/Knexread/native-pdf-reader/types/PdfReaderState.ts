import type { PdfAnnotationRecord } from "./PdfAnnotation";
import type { PdfCitationRecord } from "./PdfCitationExtraction";
import type { PdfDocumentSource } from "./PdfDocumentSource";
import type { PdfHighlightRecord } from "./PdfHighlight";
import type { PdfTranslationBlockRecord } from "./PdfTranslation";

export type PdfReaderViewMode = "single-page" | "continuous" | "two-page";
export type PdfReaderSidebarMode =
  | "thumbnails"
  | "annotations"
  | "search"
  | "source-info"
  | "none";

export type PdfTranslationViewMode =
  | "normal"
  | "side-by-side"
  | "toggle"
  | "focus-review";

export type PdfTranslationRuntime = "desktop" | "pwa" | "web";

export type PdfTranslationStrategy =
  | "local-first"
  | "local-only"
  | "online-first"
  | "online-only"
  | "auto";

export type PdfZoomMode = "manual" | "fit-width" | "fit-page" | "auto";

export type PdfRenderQualityMode =
  | "draft"
  | "standard"
  | "high"
  | "ultra"
  | "extreme"
  | "auto"
  | "economy"
  | "very-high";

export type PdfReaderRibbonTab =
  | "arquivo"
  | "inicio"
  | "leitura"
  | "traducao"
  | "revisao"
  | "anotacoes"
  | "visualizacao"
  | "exportar"
  | "configuracoes";

export type PdfReaderSessionRecord = {
  id: string;
  pdfFileId: string;
  projectId: string;
  documentId?: string;
  currentPage: number;
  zoom: number;
  rotation?: number;
  scrollTop?: number;
  viewMode?: PdfReaderViewMode;
  sidebarMode?: PdfReaderSidebarMode;
  zoomMode?: PdfZoomMode;
  renderQuality?: PdfRenderQualityMode;
  translationViewMode?: PdfTranslationViewMode;
  translationStrategy?: PdfTranslationStrategy;
  sourceLanguage?: string;
  targetLanguage?: string;
  focusedBlockId?: string;
  createdAt: string;
  updatedAt: string;
};

export type PdfReaderState = {
  isOpen: boolean;
  pdfFile?: PdfDocumentSource;
  session?: PdfReaderSessionRecord;
  highlights: PdfHighlightRecord[];
  annotations: PdfAnnotationRecord[];
  citations: PdfCitationRecord[];
  translationBlocks: PdfTranslationBlockRecord[];
};
