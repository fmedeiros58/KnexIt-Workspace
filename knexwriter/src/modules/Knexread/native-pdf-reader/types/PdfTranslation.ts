import type { PdfGeoBlockType, PdfGeoTextStyle } from "./PdfGeoText";
import type { PdfRenderQualityMode, PdfZoomMode } from "./PdfReaderState";

export type PdfTranslationBlockStatus =
  | "pending"
  | "translated"
  | "reviewed"
  | "edited"
  | "overflow"
  | "error";

export type PdfTranslationBlockRecord = {
  id: string;
  documentId: string;
  projectId: string;
  pdfFileId: string;
  pageNumber: number;
  blockId: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  style: PdfGeoTextStyle;
  blockType: PdfGeoBlockType;
  status: PdfTranslationBlockStatus;
  revision?: {
    reviewedBy?: string;
    reviewedAt?: string;
    notes?: string;
  };
  providerId?: string;
  confidence?: number;
  createdAt: string;
  updatedAt: string;
};

export type PdfTranslationRevisionRecord = {
  id: string;
  translationBlockId: string;
  pdfFileId: string;
  documentId: string;
  pageNumber: number;
  previousText: string;
  nextText: string;
  reason: "provider" | "manual-edit" | "review" | "restore-automatic";
  createdAt: string;
};

export type PdfReaderPreferencesRecord = {
  id: string;
  projectId: string;
  documentId?: string;
  zoomMode: PdfZoomMode;
  renderQuality: PdfRenderQualityMode;
  sourceLanguage: string;
  targetLanguage: string;
  translationStrategy: "local-first" | "local-only" | "online-first" | "online-only" | "auto";
  translationViewMode: "normal" | "side-by-side" | "toggle" | "focus-review";
  maskOpacity: number;
  showBlockBounds: boolean;
  showMask: boolean;
  showTextLayer: boolean;
  showRuler: boolean;
  showMargins: boolean;
  showViewportCenter: boolean;
  showPageCenter: boolean;
  enableOcrLayer: boolean;
  showOcrDebugBoxes: boolean;
  createdAt: string;
  updatedAt: string;
};
