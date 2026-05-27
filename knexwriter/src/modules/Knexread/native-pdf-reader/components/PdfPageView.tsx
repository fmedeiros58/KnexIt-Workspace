"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { capturePdfSelectionFromRange } from "../hooks";
import type {
  PdfHighlightRecord,
  PdfRenderQualityMode,
  PdfTextSelection,
} from "../types";
import type { NativePdfSession } from "../services";
import {
  extractKnexPdfPageLinks,
  extractKnexPdfPageLinksWithBackend,
  extractKnexPdfTextBlocks,
  extractKnexPdfTextBlocksWithBackend,
  getKnexPdfDocumentHandleWithBackend,
  getKnexPdfVisualRenderMode,
  resolveKnexPdfRenderPolicy,
  type KnexPdfCanvasTextSuppressionStatus,
  type KnexPdfRenderPhase,
  type KnexPdfPageLinkAnnotation as PdfPageLinkAnnotation,
  type KnexPdfRenderedPage as RenderedPdfPage,
  type KnexPdfTextBlock as PdfTextBlock,
  useKnexPdfEngine,
  useKnexPdfEngineState,
} from "../knex-pdf-engine";
import { PdfAnnotationLayer } from "./PdfAnnotationLayer";
import { PdfDebugOverlay } from "./PdfDebugOverlay";
import { PdfExperimentalVisualTextLayer } from "./PdfExperimentalVisualTextLayer";
import { PdfHighlightLayer } from "./PdfHighlightLayer";
import { PdfInvisibleTextLayer } from "./PdfInvisibleTextLayer";
import {
  type PdfCanvasTextRenderState,
} from "./PdfPageCanvas";
import { PdfRasterLayer } from "./PdfRasterLayer";
import { PdfTiledPageCanvas } from "./pdf-tiles/PdfTiledPageCanvas";

type PdfPageBaseSize = {
  width: number;
  height: number;
};

type PdfPageRenderBand = "active" | "warmup" | "prefetch" | "idle";

const FALLBACK_PAGE_WIDTH_PT = 612;
const FALLBACK_PAGE_HEIGHT_PT = 792;
const MIN_LAYOUT_SCALE = 0.01;
const MAX_LAYOUT_SCALE = 80;

const TEXT_EXTRACTION_IDLE_DELAY_MS = 0;
const LINK_EXTRACTION_IDLE_DELAY_MS = 180;

/**
 * A camada textual vetorial deve ser extraída em uma escala estável.
 *
 * Não extraímos texto no zoom atual, porque isso prende os blocos ao zoom
 * e faz o texto aparecer/desaparecer quando blocksScale deixa de bater com
 * layoutScale.
 */
const TEXT_LAYER_BASE_SCALE = 1;
const PAGEVIEW_AUDIT_VERSION = "hybrid-visual-audit-003";
const EXPERIMENTAL_VISUAL_TEXT_LAYER_FLAG =
  "KNEX_PDF_EXPERIMENTAL_VISUAL_TEXT_LAYER";
const HYBRID_VISUAL_TEXT_LAYER_ENABLE_FLAG =
  "KNEX_PDF_ENABLE_HYBRID_VISUAL_TEXT_LAYER";
const HYBRID_VISUAL_TEXT_LAYER_DISABLE_FLAG =
  "KNEX_PDF_DISABLE_HYBRID_VISUAL_TEXT_LAYER";
const HYBRID_VISUAL_TEXT_LAYER_FORCE_FLAG =
  "KNEX_PDF_FORCE_VISUAL_TEXT_LAYER";

function safeNumber(
  value: number | null | undefined,
  fallback = 0,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function clamp(value: number, min: number, max: number): number {
  const safeMin = safeNumber(min, 0);
  const safeMax = Math.max(safeMin, safeNumber(max, safeMin));
  const safeValue = safeNumber(value, safeMin);

  return Math.max(safeMin, Math.min(safeMax, safeValue));
}

function getLayoutScaleFromZoom(zoom: number): number {
  return clamp(safeNumber(zoom, 100) / 100, MIN_LAYOUT_SCALE, MAX_LAYOUT_SCALE);
}

function getFallbackPageSize(): PdfPageBaseSize {
  return {
    width: FALLBACK_PAGE_WIDTH_PT,
    height: FALLBACK_PAGE_HEIGHT_PT,
  };
}

const pdfPageBaseSizeCache = new WeakMap<
  NativePdfSession,
  Map<number, PdfPageBaseSize>
>();

function arePageSizesEquivalent(
  a: PdfPageBaseSize | null,
  b: PdfPageBaseSize,
): boolean {
  return (
    Boolean(a) &&
    Math.abs((a?.width ?? 0) - b.width) < 0.5 &&
    Math.abs((a?.height ?? 0) - b.height) < 0.5
  );
}

function readCachedPageBaseSize(
  session: NativePdfSession,
  pageNumber: number,
): PdfPageBaseSize | null {
  return pdfPageBaseSizeCache.get(session)?.get(pageNumber) ?? null;
}

function writeCachedPageBaseSize(input: {
  session: NativePdfSession;
  pageNumber: number;
  size: PdfPageBaseSize;
}) {
  const current =
    pdfPageBaseSizeCache.get(input.session) ?? new Map<number, PdfPageBaseSize>();

  current.set(input.pageNumber, input.size);
  pdfPageBaseSizeCache.set(input.session, current);
}

function getPageSizeFromRenderedPage(
  renderedPage: RenderedPdfPage | null,
): PdfPageBaseSize | null {
  if (!renderedPage) return null;

  if (renderedPage.geometry) {
    return {
      width: Math.max(1, renderedPage.geometry.baseWidth),
      height: Math.max(1, renderedPage.geometry.baseHeight),
    };
  }

  const renderScale = Math.max(0.01, safeNumber(renderedPage.renderScale, 1));

  const width =
    safeNumber(renderedPage.pageWidthPt, 0) > 0
      ? renderedPage.pageWidthPt
      : safeNumber(renderedPage.cssWidth, 0) > 0
        ? renderedPage.cssWidth / renderScale
        : safeNumber(renderedPage.width, FALLBACK_PAGE_WIDTH_PT) / renderScale;

  const height =
    safeNumber(renderedPage.pageHeightPt, 0) > 0
      ? renderedPage.pageHeightPt
      : safeNumber(renderedPage.cssHeight, 0) > 0
        ? renderedPage.cssHeight / renderScale
        : safeNumber(renderedPage.height, FALLBACK_PAGE_HEIGHT_PT) /
          renderScale;

  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

function getRenderBand(input: {
  isActivePage: boolean;
  isWarmupPage: boolean;
  isNearViewport: boolean;
  priority: boolean;
}): PdfPageRenderBand {
  if (input.priority || input.isActivePage) {
    return "active";
  }

  if (input.isWarmupPage) {
    return "warmup";
  }

  if (input.isNearViewport) {
    return "prefetch";
  }

  return "idle";
}

function resolveCanvasRenderQuality(input: {
  renderBand: PdfPageRenderBand;
  requestedQuality: PdfRenderQualityMode;
}): PdfRenderQualityMode {
  if (input.renderBand === "active" || input.renderBand === "warmup") {
    return "extreme";
  }

  return input.requestedQuality;
}

function getGlobalBoolean(key: string): boolean {
  const value = (globalThis as unknown as Record<string, unknown>)[key];

  return value === true || value === "true" || value === "1";
}

function isExperimentalVisualTextLayerAllowed(): boolean {
  return getGlobalBoolean(EXPERIMENTAL_VISUAL_TEXT_LAYER_FLAG);
}

function isHybridVisualTextLayerEnabled(): boolean {
  return (
    isExperimentalVisualTextLayerAllowed() &&
    getGlobalBoolean(HYBRID_VISUAL_TEXT_LAYER_ENABLE_FLAG)
  );
}

function isForcedVisualTextLayerEnabled(): boolean {
  return (
    isExperimentalVisualTextLayerAllowed() &&
    getGlobalBoolean(HYBRID_VISUAL_TEXT_LAYER_FORCE_FLAG)
  );
}

function isKnexPdfPageDebugEnabled(): boolean {
  return (
    getGlobalBoolean("KNEX_PDF_DEBUG_RENDER") ||
    getGlobalBoolean("KNEX_PDF_DEBUG_PAGE_GEOMETRY") ||
    getGlobalBoolean("KNEX_PDF_DEBUG_CACHE")
  );
}

function getCanvasTextMode(
  state: PdfCanvasTextRenderState | null,
): string | undefined {
  return (
    state as (PdfCanvasTextRenderState & { canvasTextMode?: string }) | null
  )?.canvasTextMode;
}

function getCanvasTextSuppressionStatus(
  state: PdfCanvasTextRenderState | null,
): string | undefined {
  return (
    state as
      | (PdfCanvasTextRenderState & { textSuppressionStatus?: string })
      | null
  )?.textSuppressionStatus;
}

function hasConfirmedTextlessCanvas(input: {
  renderedPage: RenderedPdfPage | null;
  canvasTextRenderState: PdfCanvasTextRenderState | null;
}): boolean {
  const canvasTextMode = getCanvasTextMode(input.canvasTextRenderState);
  const textSuppressionStatus = getCanvasTextSuppressionStatus(
    input.canvasTextRenderState,
  );

  if (
    input.canvasTextRenderState?.renderText !== false ||
    canvasTextMode !== "without-text"
  ) {
    return false;
  }

  if (
    input.renderedPage?.renderMode === "hybrid-visual" &&
    input.renderedPage?.textLayerMode === "visual"
  ) {
    return true;
  }

  return textSuppressionStatus === "applied";
}

function areScalesCompatible(
  a: number | null | undefined,
  b: number | null | undefined,
): boolean {
  if (typeof a !== "number" || typeof b !== "number") return false;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;

  return Math.abs(a - b) <= 0.01;
}

function hasValidTextBlockScale(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function scaleTextBlockToCss(
  block: PdfTextBlock,
  scale: number,
): PdfTextBlock {
  if (Math.abs(scale - 1) <= 0.0001) return block;

  return {
    ...block,
    x: block.x * scale,
    y: block.y * scale,
    width: block.width * scale,
    height: block.height * scale,
    fontSize: block.fontSize * scale,
    lineHeight: block.lineHeight * scale,
    letterSpacing: block.letterSpacing * scale,
  };
}

type HybridVisualFitness = {
  allowed: boolean;
  reason: string;
  blockCount: number;
  averageFontSize: number;
  tinyBlockRatio: number;
  smallFontRatio: number;
  largeFontRatio: number;
  pageCoverage: number;
};

function analyzeHybridVisualFitness(input: {
  blocks: PdfTextBlock[];
  blocksScale: number | null;
  layoutScale: number;
  averageTextConfidence?: number;
}): HybridVisualFitness {
  if (!hasValidTextBlockScale(input.blocksScale)) {
    return {
      allowed: false,
      reason: "escala-textual-invalida",
      blockCount: input.blocks.length,
      averageFontSize: 0,
      tinyBlockRatio: 1,
      smallFontRatio: 1,
      largeFontRatio: 0,
      pageCoverage: 0,
    };
  }

  const blocks = input.blocks.filter((block) => {
    return (
      Boolean(block.text?.trim()) &&
      safeNumber(block.width, 0) > 0 &&
      safeNumber(block.height, 0) > 0
    );
  });

  const blockCount = blocks.length;

  if (blockCount === 0) {
    return {
      allowed: false,
      reason: "sem-blocos-textuais",
      blockCount: 0,
      averageFontSize: 0,
      tinyBlockRatio: 1,
      smallFontRatio: 1,
      largeFontRatio: 0,
      pageCoverage: 0,
    };
  }

  let totalFontSize = 0;
  let tinyCount = 0;
  let smallCount = 0;
  let largeCount = 0;
  let totalArea = 0;

  for (const block of blocks) {
    const fontSize = safeNumber(block.fontSize, 0);
    const height = safeNumber(block.height, 0);
    const width = safeNumber(block.width, 0);

    totalFontSize += fontSize;
    totalArea += Math.max(0, width * height);

    if (fontSize < 6.5 || height < 4) {
      tinyCount += 1;
    }

    if (fontSize < 9) {
      smallCount += 1;
    }

    if (fontSize >= 12 || height >= 11) {
      largeCount += 1;
    }
  }

  const averageFontSize = totalFontSize / Math.max(1, blockCount);
  const tinyBlockRatio = tinyCount / Math.max(1, blockCount);
  const smallFontRatio = smallCount / Math.max(1, blockCount);
  const largeFontRatio = largeCount / Math.max(1, blockCount);
  const pageCoverage = totalArea;

  const confidence = safeNumber(input.averageTextConfidence, 0);

  /**
   * Regra central:
   * O HTML visual não deve substituir o PDFium em páginas densas com texto
   * pequeno. Nesses casos, o rasterizador do PDFium é mais fiel, principalmente
   * em zoom baixo.
   */
  if (confidence < 0.55) {
    return {
      allowed: false,
      reason: "confianca-baixa",
      blockCount,
      averageFontSize,
      tinyBlockRatio,
      smallFontRatio,
      largeFontRatio,
      pageCoverage,
    };
  }

  if (blockCount > 220 && averageFontSize < 10.5) {
    return {
      allowed: false,
      reason: "pagina-densa-com-fonte-pequena",
      blockCount,
      averageFontSize,
      tinyBlockRatio,
      smallFontRatio,
      largeFontRatio,
      pageCoverage,
    };
  }

  if (tinyBlockRatio > 0.35) {
    return {
      allowed: false,
      reason: "muitos-blocos-minusculos",
      blockCount,
      averageFontSize,
      tinyBlockRatio,
      smallFontRatio,
      largeFontRatio,
      pageCoverage,
    };
  }

  if (blockCount > 120 && smallFontRatio > 0.6 && largeFontRatio < 0.25) {
    return {
      allowed: false,
      reason: "texto-corrido-pequeno",
      blockCount,
      averageFontSize,
      tinyBlockRatio,
      smallFontRatio,
      largeFontRatio,
      pageCoverage,
    };
  }

  /**
   * Liberar visual HTML apenas para páginas com baixa densidade ou predominância
   * de texto grande, como capas, folhas de rosto, slides ou páginas simples.
   */
  const allowed =
    blockCount <= 140 ||
    averageFontSize >= 11.5 ||
    largeFontRatio >= 0.35;

  return {
    allowed,
    reason: allowed ? "perfil-visual-seguro" : "perfil-visual-nao-seguro",
    blockCount,
    averageFontSize,
    tinyBlockRatio,
    smallFontRatio,
    largeFontRatio,
    pageCoverage,
  };
}

function canRequestHybridVisualCanvas(input: {
  activeBackend: string;
  renderPhase: KnexPdfRenderPhase;
  isZooming: boolean;
  isScrolling: boolean;
  isWarmupPage: boolean;
  isActivePage: boolean;
  isNearViewport: boolean;
  priority: boolean;
  blocks: PdfTextBlock[];
  blocksScale: number | null;
  layoutScale: number;
  averageTextConfidence?: number;
  forceVisualTextLayer: boolean;
  enableHybridVisualTextLayer: boolean;
  visualFitness: HybridVisualFitness;
}): boolean {
  if (input.activeBackend === "pdfjs") return false;

  if (getGlobalBoolean(HYBRID_VISUAL_TEXT_LAYER_DISABLE_FLAG)) {
    return false;
  }

  if (input.renderPhase !== "settled-final") return false;
  if (input.isZooming || input.isScrolling || input.isWarmupPage) return false;

  const isPreparedBand =
    input.isActivePage ||
    input.isNearViewport ||
    input.priority;

  if (!isPreparedBand) return false;

  /**
   * Mudança importante:
   * Não pedimos mais canvas sem texto como padrão universal.
   *
   * Antes, páginas densas eram renderizadas sem texto e ficavam dependentes da
   * camada HTML. Em artigos científicos e textos pequenos, isso gerava letras
   * minúsculas, traços, apagamento visual e sumiço ao trocar zoom.
   *
   * Agora, só pedimos canvas sem texto quando a página já possui blocos
   * extraídos e o perfil visual é seguro.
   */
  if (input.blocks.length === 0 || !hasValidTextBlockScale(input.blocksScale)) {
    return false;
  }

  if (input.forceVisualTextLayer) {
    return true;
  }

  if (!input.enableHybridVisualTextLayer) {
    return false;
  }

  return input.visualFitness.allowed;
}

function canShowHybridVisualTextLayer(input: {
  renderedPage: RenderedPdfPage | null;
  canvasTextRenderState: PdfCanvasTextRenderState | null;
  blocks: PdfTextBlock[];
  blocksScale: number | null;
  layoutScale: number;
  renderPhase: KnexPdfRenderPhase;
  isZooming: boolean;
  isScrolling: boolean;
  isWarmupPage: boolean;
  forceVisualTextLayer: boolean;
  shouldRequestHybridVisualCanvas: boolean;
}): boolean {
  if (input.blocks.length === 0) return false;
  if (safeNumber(input.blocksScale, 0) <= 0) return false;

  /**
   * A camada vetorial visual só pode aparecer quando o canvas já foi confirmado
   * como canvas sem texto. Isso elimina a sobreposição: se o canvas atual ainda
   * for antigo, com texto rasterizado, o vetorial fica aguardando.
   */
  return hasConfirmedTextlessCanvas({
    renderedPage: input.renderedPage,
    canvasTextRenderState: input.canvasTextRenderState,
  });
}



/**
 * PdfPageView
 * ------------------------------------------------------------
 * Modo profissional real:
 *
 * hybrid-semantic:
 *   canvas completo, com texto rasterizado
 *   +
 *   camada textual semântica invisível
 *
 * hybrid-visual:
 *   canvas sem texto rasterizado
 *   +
 *   camada textual visual HTML/CSS
 *   +
 *   camada semântica invisível para seleção
 *
 * Regra de segurança:
 *   nunca exibir texto vetorial visível quando o canvas ainda contém texto.
 */
export function PdfPageView({
  session,
  pdfFileId,
  pageNumber,
  zoom,
  highlights,
  onSelectText,
  onBlocksChange,
  onRendered,
  showTextLayer = true,
  enableSelection = true,
  renderQuality = "extreme",
  priority = false,
  onNavigateToPage,
  isActivePage = false,
  isZooming = false,
  isScrolling = false,
  shouldRenderCanvas = true,
  renderPhase = "settled-final",
  finalRenderVersion = 0,
  isWarmupPage = false,
  renderPriority,
}: {
  session: NativePdfSession;
  pdfFileId?: string;
  pageNumber: number;
  zoom: number;
  highlights: PdfHighlightRecord[];
  onSelectText: (
    selection: PdfTextSelection,
    position: { top: number; left: number },
  ) => void;
  onBlocksChange?: (
    pageNumber: number,
    blocks: PdfTextBlock[],
    renderScale: number,
  ) => void;
  onRendered?: (page: RenderedPdfPage) => void;
  showTextLayer?: boolean;
  enableSelection?: boolean;
  renderQuality?: PdfRenderQualityMode;
  priority?: boolean;
  onNavigateToPage?: (pageNumber: number) => void;
  isActivePage?: boolean;
  isZooming?: boolean;
  isScrolling?: boolean;
  shouldRenderCanvas?: boolean;
  renderPhase?: KnexPdfRenderPhase;
  finalRenderVersion?: number;
  isWarmupPage?: boolean;
  renderPriority?: number;
}) {
  const engine = useKnexPdfEngine();
  const engineState = useKnexPdfEngineState();
  const visualRenderMode = getKnexPdfVisualRenderMode();
  const shouldUseTiledCanvas =
    visualRenderMode === "tiled-canvas" ||
    visualRenderMode === "server-tiled" ||
    visualRenderMode === "auto-professional";
  const rootRef = useRef<HTMLDivElement | null>(null);
  const textExtractionTicketRef = useRef(0);
  const linkExtractionTicketRef = useRef(0);
  const lastGoodTextBlocksRef = useRef<{
    pageNumber: number;
    blocks: PdfTextBlock[];
    scale: number;
  } | null>(null);

  const [renderedPage, setRenderedPage] = useState<RenderedPdfPage | null>(null);
  const [blocks, setBlocks] = useState<PdfTextBlock[]>([]);
  const [blocksScale, setBlocksScale] = useState<number | null>(null);
  const [textExtractionReady, setTextExtractionReady] = useState(false);
  const [canvasTextRenderState, setCanvasTextRenderState] =
    useState<PdfCanvasTextRenderState | null>(null);
  const [links, setLinks] = useState<PdfPageLinkAnnotation[]>([]);
  const [isNearViewport, setIsNearViewport] = useState(priority);
  const [pageSize, setPageSize] = useState<PdfPageBaseSize | null>(() =>
    readCachedPageBaseSize(session, pageNumber),
  );
  const [forceVisualTextLayer, setForceVisualTextLayer] = useState(() =>
    isForcedVisualTextLayerEnabled(),
  );
  const [enableHybridVisualTextLayer, setEnableHybridVisualTextLayer] =
    useState(() => isHybridVisualTextLayerEnabled());
  const [debugOverlayEnabled, setDebugOverlayEnabled] = useState(() =>
    isKnexPdfPageDebugEnabled(),
  );

  const layoutScale = useMemo(
    () => getLayoutScaleFromZoom(zoom),
    [zoom],
  );

  const renderBand = useMemo(
    () =>
      getRenderBand({
        isActivePage,
        isWarmupPage,
        isNearViewport,
        priority,
      }),
    [isActivePage, isNearViewport, isWarmupPage, priority],
  );

  const effectiveCanvasRenderQuality = useMemo(
    () =>
      resolveCanvasRenderQuality({
        renderBand,
        requestedQuality: renderQuality,
      }),
    [renderBand, renderQuality],
  );

  const basePageSize = useMemo<PdfPageBaseSize>(() => {
    const renderedSize = getPageSizeFromRenderedPage(renderedPage);
    return pageSize ?? renderedSize ?? getFallbackPageSize();
  }, [pageSize, renderedPage]);

  const pageCssWidth = useMemo(
    () => Math.max(1, Math.ceil(basePageSize.width * layoutScale)),
    [basePageSize.width, layoutScale],
  );

  const pageCssHeight = useMemo(
    () => Math.max(1, Math.ceil(basePageSize.height * layoutScale)),
    [basePageSize.height, layoutScale],
  );

  const textLayerScale = useMemo(() => {
    const sourceScale = Math.max(0.01, safeNumber(blocksScale, TEXT_LAYER_BASE_SCALE));

    return layoutScale / sourceScale;
  }, [blocksScale, layoutScale]);

  const textBlocksInCssSpace = useMemo(
    () => blocks.map((block) => scaleTextBlockToCss(block, textLayerScale)),
    [blocks, textLayerScale],
  );

  const isPreloadRender = safeNumber(renderPriority, 0) >= 50;
  const canRenderCanvas =
    shouldRenderCanvas &&
    (isActivePage ||
      isWarmupPage ||
      priority ||
      isNearViewport ||
      isPreloadRender);

  const shouldLoadPageGeometry =
    isActivePage || isWarmupPage || isNearViewport || priority;

  const semanticLayersEnabled =
    renderPhase === "settled-final" &&
    !isZooming &&
    !isScrolling &&
    !isWarmupPage;

  const effectiveShowTextLayer =
    semanticLayersEnabled && (showTextLayer || enableSelection);

  const devicePixelRatio =
    typeof globalThis.devicePixelRatio === "number"
      ? globalThis.devicePixelRatio
      : 1;

  const averageTextConfidence = useMemo(() => {
    if (blocks.length === 0) return undefined;

    const total = blocks.reduce(
      (sum, block) => sum + safeNumber(block.confidence, 0),
      0,
    );

    return total / blocks.length;
  }, [blocks]);

  const hybridVisualFitness = useMemo(
    () =>
      analyzeHybridVisualFitness({
        blocks,
        blocksScale,
        layoutScale,
        averageTextConfidence,
      }),
    [averageTextConfidence, blocks, blocksScale, layoutScale],
  );

  const shouldRequestHybridVisualCanvas = canRequestHybridVisualCanvas({
    activeBackend: engineState.activeBackend,
    renderPhase,
    isZooming,
    isScrolling,
    isWarmupPage,
    isActivePage,
    isNearViewport,
    priority,
    blocks,
    blocksScale,
    layoutScale,
    averageTextConfidence,
    forceVisualTextLayer,
    enableHybridVisualTextLayer,
    visualFitness: hybridVisualFitness,
  });

  /**
   * Quando false, o canvas será renderizado sem texto.
   *
   * No modo híbrido visual real, não esperamos mais os blocos chegarem para
   * pedir o canvas sem texto. Esperar os blocos causava exatamente o flash do
   * texto original durante a rolagem.
   */
  const shouldRenderCanvasText = !shouldRequestHybridVisualCanvas;

  const shouldDelayCanvasUntilTextExtraction =
    shouldRequestHybridVisualCanvas && !textExtractionReady;

  const canvasRenderVersion = useMemo(
    () => finalRenderVersion * 10 + (shouldRenderCanvasText ? 0 : 1),
    [finalRenderVersion, shouldRenderCanvasText],
  );

  const hasConfirmedCanvasWithoutText = hasConfirmedTextlessCanvas({
    renderedPage,
    canvasTextRenderState,
  });

  const canRenderVectorTextLayer = canShowHybridVisualTextLayer({
    renderedPage,
    canvasTextRenderState,
    blocks,
    blocksScale,
    layoutScale,
    renderPhase,
    isZooming,
    isScrolling,
    isWarmupPage,
    forceVisualTextLayer,
    shouldRequestHybridVisualCanvas,
  });

  const canvasTextSuppressionStatus: KnexPdfCanvasTextSuppressionStatus =
    "unknown";

  const renderPolicy = useMemo(
    () =>
      resolveKnexPdfRenderPolicy({
        activeBackend: engineState.activeBackend,
        preferredBackend: engineState.preferredBackend,
        zoom,
        devicePixelRatio,
        renderPhase,
        isZooming,
        isScrolling,
        isActivePage,
        isPageVisible: isNearViewport,
        isWarmupPage,
        textBlockCount: blocks.length,
        averageTextConfidence,
        requestedQuality: effectiveCanvasRenderQuality,
        cssWidth: pageCssWidth,
        cssHeight: pageCssHeight,
        canvasTextSuppressionStatus,
      }),
    [
      averageTextConfidence,
      blocks.length,
      canvasTextSuppressionStatus,
      devicePixelRatio,
      effectiveCanvasRenderQuality,
      engineState.activeBackend,
      engineState.preferredBackend,
      isActivePage,
      isNearViewport,
      isScrolling,
      isWarmupPage,
      isZooming,
      pageCssHeight,
      pageCssWidth,
      renderPhase,
      zoom,
    ],
  );

  const hasVectorTextBlocks =
    blocks.length > 0 && blocksScale !== null && blocksScale > 0;

  const canvasTextHiddenForVectorLayer = shouldRequestHybridVisualCanvas;

  const shouldHideCanvasUntilTextlessRender =
    shouldRequestHybridVisualCanvas &&
    !shouldDelayCanvasUntilTextExtraction &&
    !hasConfirmedCanvasWithoutText;

  /**
   * A extração textual deve ocorrer em paralelo ao primeiro render sem texto.
   *
   * O primeiro render normalmente será hybrid-semantic.
   * Depois de extrair blocos confiáveis, a página ativa poderá pedir
   * um novo render sem texto e, se confirmado, montar a camada visual.
   */
  const textPreparationEnabled =
    forceVisualTextLayer ||
    engineState.activeBackend !== "pdfjs" ||
    (!isZooming && !isScrolling);

  const shouldExtractText =
    textPreparationEnabled &&
    canRenderCanvas &&
    (isActivePage || isNearViewport || isWarmupPage || priority) &&
    (forceVisualTextLayer ||
      effectiveShowTextLayer ||
      engineState.activeBackend !== "pdfjs" ||
      renderPolicy.visualTextLayerCandidate ||
      Boolean(onBlocksChange));

  const shouldExtractLinks =
    semanticLayersEnabled &&
    canRenderCanvas &&
    (isActivePage || isNearViewport || priority);

  const nearViewportRootMargin = useMemo(() => {
    if (engineState.activeBackend === "pdfjs") {
      return isZooming ? "2000px 0px 2000px 0px" : "3200px 0px 3200px 0px";
    }

    return isZooming
      ? "1800px 0px 1800px 0px"
      : "2600px 0px 2600px 0px";
  }, [engineState.activeBackend, isZooming]);

  useEffect(() => {
    setCanvasTextRenderState(null);
    setTextExtractionReady(false);
  }, [pageNumber, session]);

  useEffect(() => {
    const syncForcedVisualTextLayer = () => {
      setForceVisualTextLayer(isForcedVisualTextLayerEnabled());
      setEnableHybridVisualTextLayer(isHybridVisualTextLayerEnabled());
      setDebugOverlayEnabled(isKnexPdfPageDebugEnabled());
    };

    syncForcedVisualTextLayer();

    const intervalId = window.setInterval(syncForcedVisualTextLayer, 250);

    window.addEventListener("focus", syncForcedVisualTextLayer);
    window.addEventListener("keydown", syncForcedVisualTextLayer);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncForcedVisualTextLayer);
      window.removeEventListener("keydown", syncForcedVisualTextLayer);
    };
  }, []);

  useEffect(() => {
    const cachedSize = readCachedPageBaseSize(session, pageNumber);

    if (cachedSize) {
      setPageSize((current) =>
        arePageSizesEquivalent(current, cachedSize) ? current : cachedSize,
      );
    }
  }, [pageNumber, session]);

  useEffect(() => {
    if (!shouldLoadPageGeometry) return;

    let cancelled = false;

    session.pdf
      .getPage(pageNumber)
      .then((pdfPage) => {
        if (cancelled) return;

        const viewport = pdfPage.getViewport({ scale: 1 });
        const nextSize = {
          width: Math.max(1, viewport.width),
          height: Math.max(1, viewport.height),
        };

        writeCachedPageBaseSize({
          session,
          pageNumber,
          size: nextSize,
        });
        setPageSize((current) =>
          arePageSizesEquivalent(current, nextSize) ? current : nextSize,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setPageSize((current) => current ?? getFallbackPageSize());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pageNumber, session, shouldLoadPageGeometry]);

  useEffect(() => {
    if (priority || isActivePage || isWarmupPage) {
      setIsNearViewport(true);
      return;
    }

    const root = rootRef.current;

    if (!root || typeof IntersectionObserver === "undefined") {
      setIsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsNearViewport(Boolean(entry?.isIntersecting));
      },
      {
        root: null,
        rootMargin: nearViewportRootMargin,
        threshold: 0.01,
      },
    );

    observer.observe(root);

    return () => {
      observer.disconnect();
    };
  }, [isActivePage, isWarmupPage, nearViewportRootMargin, priority]);

  useEffect(() => {
    if (!shouldExtractText) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | undefined;

    const ticket = textExtractionTicketRef.current + 1;
    textExtractionTicketRef.current = ticket;

    const scale = TEXT_LAYER_BASE_SCALE;

    const extractText = async () => {
      if (engineState.activeBackend === "pdfjs") {
        return extractKnexPdfTextBlocks({
          session,
          pageNumber,
          scale,
        });
      }

      const backend = engine.getBackend();

      try {
        const document = await getKnexPdfDocumentHandleWithBackend({
          backend,
          session,
        });

        return await extractKnexPdfTextBlocksWithBackend({
          backend,
          document,
          pageNumber,
          scale,
        });
      } catch (backendError) {
        const reason =
          backendError instanceof Error
            ? backendError.message
            : "Backend text extraction failed.";

        engine.reportBackendError({
          backend: engineState.activeBackend,
          reason,
          error: backendError,
        });

        return extractKnexPdfTextBlocks({
          session,
          pageNumber,
          scale,
        });
      }
    };

    timeoutId = window.setTimeout(() => {
      extractText()
        .then((nextBlocks) => {
          if (cancelled || ticket !== textExtractionTicketRef.current) return;

          setTextExtractionReady(true);

          if (nextBlocks.length > 0) {
            lastGoodTextBlocksRef.current = {
              pageNumber,
              blocks: nextBlocks,
              scale,
            };

            setBlocks(nextBlocks);
            setBlocksScale(scale);
            onBlocksChange?.(pageNumber, nextBlocks, scale);
            return;
          }

          const lastGood = lastGoodTextBlocksRef.current;

          if (lastGood?.pageNumber === pageNumber && lastGood.blocks.length > 0) {
            setBlocks(lastGood.blocks);
            setBlocksScale(lastGood.scale);
            onBlocksChange?.(pageNumber, lastGood.blocks, lastGood.scale);
            return;
          }

          setBlocks([]);
          setBlocksScale(null);
          onBlocksChange?.(pageNumber, [], scale);
        })
        .catch(() => {
          if (cancelled || ticket !== textExtractionTicketRef.current) return;

          setTextExtractionReady(true);

          const lastGood = lastGoodTextBlocksRef.current;

          if (lastGood?.pageNumber === pageNumber && lastGood.blocks.length > 0) {
            setBlocks(lastGood.blocks);
            setBlocksScale(lastGood.scale);
            onBlocksChange?.(pageNumber, lastGood.blocks, lastGood.scale);
            return;
          }

          setBlocks([]);
          setBlocksScale(null);
          onBlocksChange?.(pageNumber, [], scale);
        });
    }, TEXT_EXTRACTION_IDLE_DELAY_MS);

    return () => {
      cancelled = true;

      if (typeof timeoutId === "number") {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    engine,
    engineState.activeBackend,
    engineState.backendVersion,
    engineState.preferredBackend,
    onBlocksChange,
    pageNumber,
    session,
    shouldExtractText,
  ]);

  useEffect(() => {
    if (!shouldExtractLinks) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | undefined;

    const ticket = linkExtractionTicketRef.current + 1;
    linkExtractionTicketRef.current = ticket;

    const scale = layoutScale;

    const extractLinks = async () => {
      if (engineState.activeBackend === "pdfjs") {
        return extractKnexPdfPageLinks({
          session,
          pageNumber,
          scale,
        });
      }

      const backend = engine.getBackend();

      try {
        const document = await getKnexPdfDocumentHandleWithBackend({
          backend,
          session,
        });

        return await extractKnexPdfPageLinksWithBackend({
          backend,
          document,
          pageNumber,
          scale,
        });
      } catch (backendError) {
        const reason =
          backendError instanceof Error
            ? backendError.message
            : "Backend annotation extraction failed.";

        engine.reportBackendError({
          backend: engineState.activeBackend,
          reason,
          error: backendError,
        });

        return extractKnexPdfPageLinks({
          session,
          pageNumber,
          scale,
        });
      }
    };

    timeoutId = window.setTimeout(() => {
      extractLinks()
        .then((nextLinks) => {
          if (cancelled || ticket !== linkExtractionTicketRef.current) return;
          setLinks(nextLinks);
        })
        .catch(() => {
          if (cancelled || ticket !== linkExtractionTicketRef.current) return;
          setLinks([]);
        });
    }, LINK_EXTRACTION_IDLE_DELAY_MS);

    return () => {
      cancelled = true;

      if (typeof timeoutId === "number") {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    engine,
    engineState.activeBackend,
    engineState.backendVersion,
    engineState.preferredBackend,
    layoutScale,
    pageNumber,
    session,
    shouldExtractLinks,
  ]);

  useEffect(() => {
    if (!getGlobalBoolean("KNEX_PDF_DEBUG_VISUAL_TEXT")) return;

    // eslint-disable-next-line no-console
    console.debug("[KnexRead][PdfPageViewAudit]", {
      auditVersion: PAGEVIEW_AUDIT_VERSION,
      pageNumber,
      forceVisualTextLayer,
      canRenderCanvas,
      shouldExtractText,
      shouldRequestHybridVisualCanvas,
      shouldRenderCanvasText,
      shouldDelayCanvasUntilTextExtraction,
      textExtractionReady,
      canvasRenderVersion,
      hasConfirmedCanvasWithoutText,
      shouldHideCanvasUntilTextlessRender,
      canRenderVectorTextLayer,
      blocksCount: blocks.length,
      blocksScale,
      layoutScale,
      textLayerScale,
      renderPhase,
      isZooming,
      isScrolling,
      isWarmupPage,
      isActivePage,
      isNearViewport,
      activeBackend: engineState.activeBackend,
      renderedMode: renderedPage?.renderMode,
      renderedTextLayerMode: renderedPage?.textLayerMode,
      canvasTextRenderState,
      firstBlock: blocks[0],
    });
  }, [
    blocks,
    blocksScale,
    canvasTextRenderState,
    canRenderCanvas,
    canRenderVectorTextLayer,
    canvasRenderVersion,
    engineState.activeBackend,
    hasConfirmedCanvasWithoutText,
    forceVisualTextLayer,
    isActivePage,
    isNearViewport,
    isScrolling,
    isWarmupPage,
    isZooming,
    layoutScale,
    pageNumber,
    renderPhase,
    renderedPage,
    shouldDelayCanvasUntilTextExtraction,
    shouldExtractText,
    shouldHideCanvasUntilTextlessRender,
    shouldRenderCanvasText,
    shouldRequestHybridVisualCanvas,
    textExtractionReady,
    textLayerScale,
  ]);

  const handleRendered = useCallback(
    (page: RenderedPdfPage) => {
      setRenderedPage(page);
      onRendered?.(page);
    },
    [onRendered],
  );

  const handleCanvasTextRenderStateChange = useCallback(
    (state: PdfCanvasTextRenderState) => {
      if (state.pageNumber !== pageNumber) return;

      setCanvasTextRenderState(state);
    },
    [pageNumber],
  );

  const highlightBlockIds = useMemo(() => {
    if (!highlights.length || !blocks.length || isZooming || isScrolling) {
      return undefined;
    }

    const ids = new Set<string>();

    for (const highlight of highlights) {
      if (highlight.pageNumber !== pageNumber) continue;

      const normalizedText = highlight.normalizedText?.toLowerCase();
      if (!normalizedText) continue;

      for (const block of blocks) {
        if (block.text.toLowerCase().includes(normalizedText)) {
          ids.add(block.id);
        }
      }
    }

    return ids;
  }, [blocks, highlights, isScrolling, isZooming, pageNumber]);

  const handleMouseUp = useCallback(() => {
    if (
      !enableSelection ||
      isZooming ||
      isScrolling ||
      renderPhase !== "settled-final"
    ) {
      return;
    }

    const root = rootRef.current;
    const selection = window.getSelection();

    if (
      !root ||
      !selection ||
      selection.isCollapsed ||
      selection.rangeCount === 0
    ) {
      return;
    }

    const range = selection.getRangeAt(0);

    if (!root.contains(range.commonAncestorContainer)) {
      return;
    }

    const capturedSelection = capturePdfSelectionFromRange({
      pageNumber,
      pageBlocks: blocks,
      range,
      pageElement: root,
    });

    if (!capturedSelection) return;

    const rects = range.getClientRects();
    const lastRect =
      rects.item(rects.length - 1) ?? range.getBoundingClientRect();

    const position = {
      top: lastRect.bottom + window.scrollY + 8,
      left: lastRect.left + window.scrollX,
    };

    onSelectText(capturedSelection, position);
  }, [
    blocks,
    enableSelection,
    isScrolling,
    isZooming,
    onSelectText,
    pageNumber,
    renderPhase,
  ]);

  const handleLinkClick = useCallback(
    async (link: PdfPageLinkAnnotation) => {
      if (isZooming || isScrolling || renderPhase !== "settled-final") return;

      if (link.url) {
        window.open(link.url, "_blank", "noopener,noreferrer");
        return;
      }

      if (!link.dest || !onNavigateToPage) return;

      try {
        if (typeof session.pdf.getDestination !== "function") return;
        if (typeof session.pdf.getPageIndex !== "function") return;

        const destination = Array.isArray(link.dest)
          ? link.dest
          : await session.pdf.getDestination(String(link.dest));

        const reference = destination?.[0];

        if (!reference) return;

        const pageIndex = await session.pdf.getPageIndex(reference);

        onNavigateToPage(pageIndex + 1);
      } catch {
        /**
         * Destinos inválidos do PDF são ignorados.
         * A anotação permanece visível.
         */
      }
    },
    [isScrolling, isZooming, onNavigateToPage, renderPhase, session],
  );

  return (
    <div
      ref={rootRef}
      className="relative block shrink-0"
      onMouseUp={handleMouseUp}
      data-knexread-pageview-audit-version={PAGEVIEW_AUDIT_VERSION}
      data-knexread-page-number={pageNumber}
      data-knexread-page-active={isActivePage ? "true" : "false"}
      data-knexread-page-visible={isNearViewport ? "true" : "false"}
      data-knexread-page-warmup={isWarmupPage ? "true" : "false"}
      data-knexread-page-render-band={renderBand}
      data-knexread-page-zooming={isZooming ? "true" : "false"}
      data-knexread-page-scrolling={isScrolling ? "true" : "false"}
      data-knexread-page-render-phase={renderPhase}
      data-knexread-page-render-mode={
        canRenderVectorTextLayer ? "hybrid-visual" : renderPolicy.renderMode
      }
      data-knexread-page-visual-render-mode={visualRenderMode}
      data-knexread-page-text-layer-mode={
        canRenderVectorTextLayer ? "visual" : renderPolicy.textLayerMode
      }
      data-knexread-page-render-policy-reason={renderPolicy.reason}
      data-knexread-page-zoom-bucket={renderPolicy.zoomBucket}
      data-knexread-page-render-priority={renderPriority ?? ""}
      data-knexread-page-canvas-enabled={canRenderCanvas ? "true" : "false"}
      data-knexread-page-canvas-text-render={
        shouldRenderCanvasText ? "true" : "false"
      }
      data-knexread-page-request-hybrid-visual-canvas={
        shouldRequestHybridVisualCanvas ? "true" : "false"
      }
      data-knexread-page-text-block-count={blocks.length}
      data-knexread-page-blocks-scale={blocksScale ?? ""}
      data-knexread-page-layout-scale={layoutScale}
      data-knexread-page-text-layer-scale={textLayerScale}
      data-knexread-page-text-layer-css-width={pageCssWidth}
      data-knexread-page-text-layer-css-height={pageCssHeight}
      data-knexread-page-text-layer-css-block-count={
        textBlocksInCssSpace.length
      }
      data-knexread-page-canvas-text-hidden={
        canvasTextHiddenForVectorLayer ? "true" : "false"
      }
      data-knexread-page-canvas-textless-confirmed={
        hasConfirmedCanvasWithoutText ? "true" : "false"
      }
      data-knexread-page-canvas-hidden-until-textless={
        shouldHideCanvasUntilTextlessRender ? "true" : "false"
      }
      data-knexread-page-canvas-delayed-until-text-extraction={
        shouldDelayCanvasUntilTextExtraction ? "true" : "false"
      }
      data-knexread-page-text-extraction-ready={
        textExtractionReady ? "true" : "false"
      }
      data-knexread-page-filtered-text-operations={
        canvasTextRenderState?.filteredTextOperationCount ?? ""
      }
      data-knexread-page-visual-text-enabled={
        canRenderVectorTextLayer ? "true" : "false"
      }
      data-knexread-page-visual-text-forced={
        forceVisualTextLayer ? "true" : "false"
      }
      data-knexread-page-hybrid-visual-explicitly-enabled={
        enableHybridVisualTextLayer ? "true" : "false"
      }
      data-knexread-page-hybrid-visual-fitness={hybridVisualFitness.reason}
      data-knexread-page-hybrid-visual-average-font-size={
        hybridVisualFitness.averageFontSize
      }
      data-knexread-page-hybrid-visual-tiny-ratio={
        hybridVisualFitness.tinyBlockRatio
      }
      data-knexread-page-hybrid-visual-small-ratio={
        hybridVisualFitness.smallFontRatio
      }
      data-knexread-page-hybrid-visual-large-ratio={
        hybridVisualFitness.largeFontRatio
      }
      data-knexread-page-visual-text-pending={
        shouldRequestHybridVisualCanvas &&
        hasVectorTextBlocks &&
        !canRenderVectorTextLayer
          ? "true"
          : "false"
      }
      style={{
        width: `${pageCssWidth}px`,
        height: `${pageCssHeight}px`,
        minWidth: `${pageCssWidth}px`,
        minHeight: `${pageCssHeight}px`,
        maxWidth: `${pageCssWidth}px`,
      }}
    >
      {canRenderCanvas ? (
        shouldUseTiledCanvas ? (
          <div
            className="absolute inset-0 z-0"
            data-knexread-page-raster-layer="true"
            data-knexread-page-visual-layer="true"
            data-knexread-page-visual-render-mode={visualRenderMode}
            style={{
              width: `${pageCssWidth}px`,
              height: `${pageCssHeight}px`,
            }}
          >
            <PdfTiledPageCanvas
              session={session}
              pdfFileId={pdfFileId}
              pageNumber={pageNumber}
              zoom={zoom}
              renderQuality={effectiveCanvasRenderQuality}
              onRendered={handleRendered}
              isZooming={isZooming}
              isScrolling={isScrolling}
              renderPhase={renderPhase}
              finalRenderVersion={canvasRenderVersion}
              isActivePage={isActivePage}
              isPageVisible={isActivePage || isWarmupPage || isNearViewport}
              isWarmupPage={isWarmupPage}
              renderText={true}
              visualRenderMode={visualRenderMode}
              onCanvasTextRenderStateChange={handleCanvasTextRenderStateChange}
              renderPriority={
                renderPriority ??
                (renderBand === "active"
                  ? 100
                  : renderBand === "warmup"
                    ? 92
                    : renderBand === "prefetch"
                      ? 70
                      : 10)
              }
            />
          </div>
        ) : (
          <PdfRasterLayer
            cssWidth={pageCssWidth}
            cssHeight={pageCssHeight}
            hiddenUntilTextlessRender={shouldHideCanvasUntilTextlessRender}
            delayedUntilTextExtraction={shouldDelayCanvasUntilTextExtraction}
            session={session}
            pageNumber={pageNumber}
            zoom={zoom}
            renderQuality={effectiveCanvasRenderQuality}
            onRendered={handleRendered}
            isZooming={isZooming}
            isScrolling={isScrolling}
            renderPhase={renderPhase}
            finalRenderVersion={canvasRenderVersion}
            isActivePage={isActivePage}
            isPageVisible={isActivePage || isWarmupPage || isNearViewport}
            isWarmupPage={isWarmupPage}
            renderText={shouldRenderCanvasText}
            onCanvasTextRenderStateChange={handleCanvasTextRenderStateChange}
            renderPriority={
              renderPriority ??
              (renderBand === "active"
                ? 100
                : renderBand === "warmup"
                  ? 92
                  : renderBand === "prefetch"
                    ? 70
                    : 10)
            }
          />
        )
      ) : (
        <div
          className="absolute inset-0 z-0 rounded border border-zinc-300 bg-white shadow-sm"
          data-knexread-page-placeholder="true"
          style={{
            width: `${pageCssWidth}px`,
            height: `${pageCssHeight}px`,
          }}
        />
      )}

      {(canRenderCanvas || forceVisualTextLayer) &&
      (semanticLayersEnabled || canRenderVectorTextLayer || forceVisualTextLayer) ? (
        <>
          {semanticLayersEnabled ? (
            <div
              className="absolute inset-0 z-10"
              data-knexread-page-highlight-layer="true"
              style={{
                width: `${pageCssWidth}px`,
                height: `${pageCssHeight}px`,
              }}
            >
              <PdfHighlightLayer
                pageNumber={pageNumber}
                pageWidth={pageCssWidth}
                pageHeight={pageCssHeight}
                highlights={highlights}
              />
            </div>
          ) : null}

          {semanticLayersEnabled ? (
            <div
              className="absolute inset-0 z-20"
              data-knexread-page-annotation-layer="true"
              style={{
                width: `${pageCssWidth}px`,
                height: `${pageCssHeight}px`,
              }}
            >
              <PdfAnnotationLayer
                links={links}
                onClickLink={handleLinkClick}
              />
            </div>
          ) : null}

          {canRenderVectorTextLayer ? (
            <PdfExperimentalVisualTextLayer
              blocks={textBlocksInCssSpace}
              pageNumber={pageNumber}
              pageWidth={pageCssWidth}
              pageHeight={pageCssHeight}
              highlightedBlockIds={highlightBlockIds}
              forced={forceVisualTextLayer}
              auditLabel={`PV-AUDIT ${PAGEVIEW_AUDIT_VERSION}`}
            />
          ) : null}

          {semanticLayersEnabled && effectiveShowTextLayer ? (
            <PdfInvisibleTextLayer
              blocks={textBlocksInCssSpace}
              pageNumber={pageNumber}
              pageWidth={pageCssWidth}
              pageHeight={pageCssHeight}
              highlightedBlockIds={highlightBlockIds}
            />
          ) : null}
        </>
      ) : null}

      {debugOverlayEnabled ? (
        <PdfDebugOverlay
          pageNumber={pageNumber}
          renderedPage={renderedPage}
          canvasState={canvasTextRenderState}
          textBlockCount={blocks.length}
          annotationCount={links.length}
          highlightCount={
            highlights.filter((highlight) => highlight.pageNumber === pageNumber)
              .length
          }
        />
      ) : null}
    </div>
  );
}
