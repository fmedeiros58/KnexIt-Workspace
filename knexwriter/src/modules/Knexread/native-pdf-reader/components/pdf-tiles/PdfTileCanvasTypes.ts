import type { PdfRenderQualityMode } from "../../types";
import type { NativePdfSession } from "../../services";
import type {
  KnexPdfRenderPhase,
  KnexPdfRenderedPage as RenderedPdfPage,
} from "../../knex-pdf-engine";

export type PdfTileCanvasTextMode = "normal" | "without-text" | "unknown";

export type PdfTileRenderState = {
  documentId: string;
  pageNumber: number;
  backend: string;
  renderPhase: KnexPdfRenderPhase;
  renderQuality: string;
  renderScale: number;
  outputScale: number;
  zoom: number;
  renderText: boolean;
  canvasTextMode: PdfTileCanvasTextMode;
  filteredTextOperationCount: number;
  renderIdentity: string;
  renderVersion: number;
  backendVersion: number;
  finalRenderVersion: number;
  cacheLookup?: string;
  cacheKey?: string;
  cacheSize?: number;
  cacheBytes?: number;
};

export type PdfTiledVisualPageProps = {
  session: NativePdfSession;
  pageNumber: number;
  zoom: number;
  renderQuality: PdfRenderQualityMode;
  onRendered: (page: RenderedPdfPage) => void;
  isZooming?: boolean;
  isScrolling?: boolean;
  renderPhase?: KnexPdfRenderPhase;
  finalRenderVersion?: number;
  isActivePage?: boolean;
  isPageVisible?: boolean;
  isWarmupPage?: boolean;
  renderPriority?: number;
  renderText?: boolean;
  onCanvasTextRenderStateChange?: (state: PdfTileRenderState) => void;
};
