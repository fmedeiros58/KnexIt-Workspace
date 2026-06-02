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
  type KnexPdfRenderPhase,
  type KnexPdfPageLinkAnnotation as PdfPageLinkAnnotation,
  type KnexPdfRenderedPage as RenderedPdfPage,
  type KnexPdfTextBlock as PdfTextBlock,
  useKnexPdfEngine,
  useKnexPdfEngineState,
} from "../knex-pdf-engine";
import { PdfAnnotationLayer } from "./PdfAnnotationLayer";
import { PdfDebugOverlay } from "./PdfDebugOverlay";
import { PdfHighlightLayer } from "./PdfHighlightLayer";
import { PdfInvisibleTextLayer } from "./PdfInvisibleTextLayer";
import { PdfTextLayer } from "./PdfTextLayer";
import { type PdfTileRenderState } from "./pdf-tiles/PdfTileCanvasTypes";
import { PdfTiledPageCanvas } from "./pdf-tiles/PdfTiledPageCanvas";
import { PdfModularPageStage } from "../../rendering/composition/PdfModularPageStage";
import { PdfPageComposition } from "../../rendering/composition/PdfPageComposition";

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
const PAGEVIEW_AUDIT_VERSION = "blueprint-default-002-no-canvas-text";

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

function isKnexPdfPageDebugEnabled(): boolean {
  return (
    getGlobalBoolean("KNEX_PDF_DEBUG_RENDER") ||
    getGlobalBoolean("KNEX_PDF_DEBUG_PAGE_GEOMETRY") ||
    getGlobalBoolean("KNEX_PDF_DEBUG_CACHE")
  );
}

type VisualTextOverrideFlags = {
  forceVisualTextLayer: boolean;
  hideCanvasTextWhenVisualLayerIsActive: boolean;
};

function readVisualTextOverrideFlags(): VisualTextOverrideFlags {
  return {
    forceVisualTextLayer: getGlobalBoolean("KNEX_PDF_FORCE_VISUAL_TEXT_LAYER"),
    hideCanvasTextWhenVisualLayerIsActive: getGlobalBoolean(
      "KNEX_PDF_HIDE_CANVAS_TEXT_WHEN_VISUAL",
    ),
  };
}

/**
 * Determina se o pipeline modular/blueprint deve ser ativado.
 *
 * O blueprint passa a ser o caminho oficial do Knexread. PDFs marcados como
 * legacy não devem cair automaticamente em tiled-canvas, porque isso mantém o
 * texto rasterizado e impede a camada HTML visual.
 *
 * Para voltar ao fluxo antigo, use uma flag explícita:
 * globalThis.KNEX_PDF_DISABLE_MODULAR_PAGE_PIPELINE = true
 * ou
 * globalThis.KNEX_PDF_FORCE_LEGACY_TILED_CANVAS = true
 */
function shouldUseModularPagePipeline(input: {
  isLegacyPdf: boolean;
  forceViaGlobal?: boolean;
}): boolean {
  void input;

  if (getGlobalBoolean("KNEX_PDF_DISABLE_MODULAR_PAGE_PIPELINE")) {
    return false;
  }

  if (getGlobalBoolean("KNEX_PDF_FORCE_LEGACY_TILED_CANVAS")) {
    return false;
  }

  if (
    getGlobalBoolean("KNEX_PDF_USE_MODULAR_PAGE_PIPELINE") ||
    getGlobalBoolean("KNEX_PDF_FORCE_SINGLE_CANVAS_PAGE") ||
    getGlobalBoolean("KNEX_PDF_USE_BLUEPRINT_MODE") ||
    getGlobalBoolean("KNEX_PDF_FORCE_BLUEPRINT_STAGE")
  ) {
    return true;
  }

  return true;
}

function shouldUseBlueprintPagePipeline(input: {
  modularPagePipelineEnabled: boolean;
}): boolean {
  if (!input.modularPagePipelineEnabled) return false;

  if (
    getGlobalBoolean("KNEX_PDF_DISABLE_BLUEPRINT_MODE") ||
    getGlobalBoolean("KNEX_PDF_FORCE_LEGACY_MODULAR_STAGE")
  ) {
    return false;
  }

  return true;
}

function getPageRenderMode(input: {
  modularPagePipelineEnabled: boolean;
  blueprintPagePipelineEnabled: boolean;
}): "blueprint" | "single-canvas-html-text" | "tiled-canvas" {
  if (!input.modularPagePipelineEnabled) return "tiled-canvas";

  return input.blueprintPagePipelineEnabled
    ? "blueprint"
    : "single-canvas-html-text";
}

function shouldRequestVisualTextLayer(input: {
  semanticLayersEnabled: boolean;
  effectiveShowTextLayer: boolean;
  forceVisualTextLayer: boolean;
}): boolean {
  return (
    input.forceVisualTextLayer &&
    input.semanticLayersEnabled &&
    input.effectiveShowTextLayer
  );
}

function shouldEnableVisualTextLayer(input: {
  visualTextLayerRequested: boolean;
  blockCount: number;
}): boolean {
  /*
   * A camada visual só é montada quando os blocos existem.
   * Mas o canvas deve parar de desenhar texto assim que o modo visual for
   * solicitado, antes mesmo da extração textual terminar. Isso evita que o
   * canvas seja renderizado com texto e depois receba a camada visual por cima,
   * causando duplicação.
   */
  return input.visualTextLayerRequested && input.blockCount > 0;
}

function shouldHideCanvasTextWhenVisualLayerIsRequested(input: {
  visualTextLayerRequested: boolean;
  hideCanvasTextWhenVisualLayerIsActive: boolean;
}): boolean {
  return (
    input.visualTextLayerRequested &&
    input.hideCanvasTextWhenVisualLayerIsActive
  );
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

/**
 * PdfPageView
 * ------------------------------------------------------------
 * Visual oficial: blueprint HTML sobre surface estrutural.
 *
 * A camada textual invisível continua responsável por seleção, cópia,
 * busca e ancoragem quando o fallback legado está ativo. No fluxo modular,
 * o blueprint monta texto HTML visível como apresentação principal.
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
  const [canvasTextRenderState, setCanvasTextRenderState] =
    useState<PdfTileRenderState | null>(null);
  const [links, setLinks] = useState<PdfPageLinkAnnotation[]>([]);
  const [isNearViewport, setIsNearViewport] = useState(priority);
  const [pageSize, setPageSize] = useState<PdfPageBaseSize | null>(() =>
    readCachedPageBaseSize(session, pageNumber),
  );
  const [debugOverlayEnabled, setDebugOverlayEnabled] = useState(() =>
    isKnexPdfPageDebugEnabled(),
  );
  const [visualTextOverrideFlags, setVisualTextOverrideFlags] = useState(
    readVisualTextOverrideFlags,
  );
  const initialModularPagePipelineEnabled = shouldUseModularPagePipeline({
    isLegacyPdf: session.isLegacy,
  });
  const [modularPagePipelineEnabled, setModularPagePipelineEnabled] = useState(
    () => initialModularPagePipelineEnabled,
  );
  const [blueprintPagePipelineEnabled, setBlueprintPagePipelineEnabled] =
    useState(() =>
      shouldUseBlueprintPagePipeline({
        modularPagePipelineEnabled: initialModularPagePipelineEnabled,
      }),
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
  const shouldMountCanvasNow = shouldRenderCanvas || isNearViewport;
  const [holdCanvasDuringInteraction, setHoldCanvasDuringInteraction] =
    useState(shouldMountCanvasNow);
  const canRenderCanvas = shouldMountCanvasNow || holdCanvasDuringInteraction;

  const shouldLoadPageGeometry =
    shouldMountCanvasNow ||
    isActivePage ||
    isWarmupPage ||
    isNearViewport ||
    priority ||
    isPreloadRender;

  const semanticLayersEnabled =
    renderPhase === "settled-final" &&
    !isZooming &&
    !isScrolling &&
    !isWarmupPage;

  const effectiveShowTextLayer =
    semanticLayersEnabled && (showTextLayer || enableSelection);

  const visualTextLayerRequested =
    shouldRequestVisualTextLayer({
      semanticLayersEnabled,
      effectiveShowTextLayer,
      forceVisualTextLayer: visualTextOverrideFlags.forceVisualTextLayer,
    }) ||
    (modularPagePipelineEnabled &&
      semanticLayersEnabled &&
      effectiveShowTextLayer);

  const hasVisualTextBlocks = textBlocksInCssSpace.length > 0;

  const visualTextLayerEnabled = shouldEnableVisualTextLayer({
    visualTextLayerRequested,
    blockCount: textBlocksInCssSpace.length,
  });

  /*
   * Regra refinada para o modo blueprint:
   *
   * No blueprint, o texto visível deve vir exclusivamente do HTML/DOM da
   * PdfPagePresentationSurface. O canvas pode continuar existindo como fallback
   * não textual, mas nunca deve rasterizar texto quando
   * blueprintPagePipelineEnabled=true.
   *
   * Isso evita duplicação visual: texto HTML do blueprint + texto antigo do
   * canvas/tile.
   */
  const shouldHideCanvasTextForModularPipeline =
    blueprintPagePipelineEnabled ||
    (modularPagePipelineEnabled && visualTextLayerRequested && hasVisualTextBlocks);

  const shouldRenderCanvasText =
    blueprintPagePipelineEnabled
      ? false
      : !hasVisualTextBlocks ||
        !(
          shouldHideCanvasTextForModularPipeline ||
          shouldHideCanvasTextWhenVisualLayerIsRequested({
            visualTextLayerRequested,
            hideCanvasTextWhenVisualLayerIsActive:
              visualTextOverrideFlags.hideCanvasTextWhenVisualLayerIsActive,
          })
        );

  /*
   * Quando a camada visual está ativa, não montamos a camada invisível.
   * Quando não há blocos visuais, a camada visual não é montada e o canvas
   * continua com texto, evitando branco/fuga de renderização.
   */
  const shouldMountInvisibleTextLayer =
    semanticLayersEnabled &&
    effectiveShowTextLayer &&
    !visualTextLayerEnabled &&
    !modularPagePipelineEnabled;

  const pageRenderMode = getPageRenderMode({
    modularPagePipelineEnabled,
    blueprintPagePipelineEnabled,
  });

  /*
   * Quando alternamos entre canvas com texto e canvas sem texto, precisamos
   * forçar nova geração dos tiles. Caso contrário, uma geração antiga com
   * texto pode permanecer em cache e receber a camada HTML por cima.
   */
  const canvasRenderVersion =
    finalRenderVersion + (shouldRenderCanvasText ? 0 : 100_000);

  const shouldExtractText =
    !modularPagePipelineEnabled &&
    canRenderCanvas &&
    (isActivePage || isNearViewport || isWarmupPage || priority) &&
    (effectiveShowTextLayer || Boolean(onBlocksChange));
  const shouldExtractLinks =
    semanticLayersEnabled &&
    canRenderCanvas &&
    (isActivePage || isNearViewport || priority);

  const nearViewportRootMargin = useMemo(() => {
    if (engineState.activeBackend === "pdfjs") {
      return isZooming ? "2200px 0px 2200px 0px" : "3200px 0px 3200px 0px";
    }

    return isZooming
      ? "2000px 0px 2000px 0px"
      : "3000px 0px 3000px 0px";
  }, [engineState.activeBackend, isZooming]);

  useEffect(() => {
    if (shouldMountCanvasNow) {
      setHoldCanvasDuringInteraction(true);
      return;
    }

    if (isZooming || isScrolling) {
      return;
    }

    const releaseTimer = window.setTimeout(() => {
      setHoldCanvasDuringInteraction(false);
    }, 1200);

    return () => {
      window.clearTimeout(releaseTimer);
    };
  }, [isScrolling, isZooming, shouldMountCanvasNow]);

  useEffect(() => {
    setCanvasTextRenderState(null);
  }, [pageNumber, session]);

  useEffect(() => {
    const syncDebugOverlay = () => {
      setDebugOverlayEnabled(isKnexPdfPageDebugEnabled());
    };

    syncDebugOverlay();

    const intervalId = window.setInterval(syncDebugOverlay, 250);

    window.addEventListener("focus", syncDebugOverlay);
    window.addEventListener("keydown", syncDebugOverlay);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncDebugOverlay);
      window.removeEventListener("keydown", syncDebugOverlay);
    };
  }, []);

  useEffect(() => {
    const syncVisualTextFlags = () => {
      const next = readVisualTextOverrideFlags();

      setVisualTextOverrideFlags((current) =>
        current.forceVisualTextLayer === next.forceVisualTextLayer &&
        current.hideCanvasTextWhenVisualLayerIsActive ===
          next.hideCanvasTextWhenVisualLayerIsActive
          ? current
          : next,
      );
    };

    syncVisualTextFlags();

    const intervalId = window.setInterval(syncVisualTextFlags, 250);

    window.addEventListener("focus", syncVisualTextFlags);
    window.addEventListener("keydown", syncVisualTextFlags);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncVisualTextFlags);
      window.removeEventListener("keydown", syncVisualTextFlags);
    };
  }, []);

  useEffect(() => {
    const syncModularPipelineFlag = () => {
      const next = shouldUseModularPagePipeline({ isLegacyPdf: session.isLegacy });

      setModularPagePipelineEnabled((current) =>
        current === next ? current : next,
      );
    };

    syncModularPipelineFlag();

    const intervalId = window.setInterval(syncModularPipelineFlag, 250);

    window.addEventListener("focus", syncModularPipelineFlag);
    window.addEventListener("keydown", syncModularPipelineFlag);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncModularPipelineFlag);
      window.removeEventListener("keydown", syncModularPipelineFlag);
    };
  }, [session.isLegacy]);

  useEffect(() => {
    const syncBlueprintPipelineFlag = () => {
      const next = shouldUseBlueprintPagePipeline({
        modularPagePipelineEnabled,
      });

      setBlueprintPagePipelineEnabled((current) =>
        current === next ? current : next,
      );
    };

    syncBlueprintPipelineFlag();

    const intervalId = window.setInterval(syncBlueprintPipelineFlag, 250);

    window.addEventListener("focus", syncBlueprintPipelineFlag);
    window.addEventListener("keydown", syncBlueprintPipelineFlag);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncBlueprintPipelineFlag);
      window.removeEventListener("keydown", syncBlueprintPipelineFlag);
    };
  }, [modularPagePipelineEnabled]);

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
    if (!getGlobalBoolean("KNEX_PDF_DEBUG_RENDER")) return;

    // eslint-disable-next-line no-console
    console.debug("[KnexRead][PdfPageViewAudit]", {
      auditVersion: PAGEVIEW_AUDIT_VERSION,
      pageNumber,
      canRenderCanvas,
      shouldExtractText,
      shouldRenderCanvasText,
      canvasRenderVersion,
      blocksCount: blocks.length,
      blocksScale,
      layoutScale,
      textLayerScale,
      modularPagePipelineEnabled,
      blueprintPagePipelineEnabled,
      pageRenderMode,
      visualTextLayerEnabled,
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
    canvasRenderVersion,
    engineState.activeBackend,
    isActivePage,
    isNearViewport,
    isScrolling,
    isWarmupPage,
    isZooming,
    layoutScale,
    modularPagePipelineEnabled,
    blueprintPagePipelineEnabled,
    pageNumber,
    pageRenderMode,
    renderPhase,
    renderedPage,
    shouldExtractText,
    shouldRenderCanvasText,
    textLayerScale,
    visualTextLayerEnabled,
  ]);

  const handleRendered = useCallback(
    (page: RenderedPdfPage) => {
      setRenderedPage(page);
      onRendered?.(page);
    },
    [onRendered],
  );

  const handleCanvasTextRenderStateChange = useCallback(
    (state: PdfTileRenderState) => {
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
      data-knexread-page-render-mode={pageRenderMode}
      data-knexread-page-modular-pipeline={
        modularPagePipelineEnabled ? "true" : "false"
      }
      data-knexread-page-blueprint-pipeline={
        blueprintPagePipelineEnabled ? "true" : "false"
      }
      data-knexread-page-visual-render-mode={visualRenderMode}
      data-knexread-page-visual-text-layer={visualTextLayerEnabled ? "true" : "false"}
      data-knexread-page-visual-text-requested={
        visualTextLayerRequested ? "true" : "false"
      }
      data-knexread-page-has-visual-text-blocks={
        hasVisualTextBlocks ? "true" : "false"
      }
      data-knexread-page-force-visual-text-layer={
        visualTextOverrideFlags.forceVisualTextLayer ? "true" : "false"
      }
      data-knexread-page-hide-canvas-text-when-visual={
        visualTextOverrideFlags.hideCanvasTextWhenVisualLayerIsActive
          ? "true"
          : "false"
      }
      data-knexread-page-hide-canvas-text-for-modular-pipeline={
        shouldHideCanvasTextForModularPipeline ? "true" : "false"
      }
      data-knexread-tile-text-render={shouldRenderCanvasText ? "true" : "false"}
      data-knexread-page-text-layer-mode={visualTextLayerEnabled ? "hybrid-visible" : "semantic-invisible"}
      data-knexread-page-invisible-text-layer-mounted={
        shouldMountInvisibleTextLayer ? "true" : "false"
      }
      data-knexread-page-render-priority={renderPriority ?? ""}
      data-knexread-page-tile-enabled={canRenderCanvas ? "true" : "false"}
      data-knexread-page-tile-text-render={
        shouldRenderCanvasText ? "true" : "false"
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
      data-knexread-page-filtered-text-operations={
        canvasTextRenderState?.filteredTextOperationCount ?? ""
      }
      style={{
        width: `${pageCssWidth}px`,
        height: `${pageCssHeight}px`,
        minWidth: `${pageCssWidth}px`,
        minHeight: `${pageCssHeight}px`,
        maxWidth: `${pageCssWidth}px`,
      }}
    >
      <PdfPageComposition
        width={pageCssWidth}
        height={pageCssHeight}
        mode={
          pageRenderMode === "blueprint" ||
          pageRenderMode === "single-canvas-html-text"
            ? "single-canvas-html-text"
            : "legacy-tiled-canvas"
        }
      >
      {canRenderCanvas ? (
        <div
          className="absolute inset-0 z-0"
          data-knexread-page-raster-layer="true"
          data-knexread-page-visual-layer="true"
          data-knexread-page-visual-render-mode={visualRenderMode}
          data-knexread-page-visual-render-official={
            pageRenderMode === "blueprint"
              ? "blueprint"
              : modularPagePipelineEnabled
                ? "single-canvas"
                : "tiled-canvas"
          }
          style={{
            width: `${pageCssWidth}px`,
            height: `${pageCssHeight}px`,
          }}
        >
          {modularPagePipelineEnabled ? (
            <PdfModularPageStage
              key={blueprintPagePipelineEnabled ? "blueprint" : "modular"}
              session={session}
              pageNumber={pageNumber}
              zoom={zoom}
              pageCssWidth={pageCssWidth}
              pageCssHeight={pageCssHeight}
              renderQuality={effectiveCanvasRenderQuality}
              onRendered={handleRendered}
              renderPhase={renderPhase}
              finalRenderVersion={canvasRenderVersion}
              highlightedRunIds={highlightBlockIds}
              onTextBlocksChange={(nextPageNumber, nextBlocks, nextScale) => {
                if (nextPageNumber !== pageNumber) return;

                if (nextBlocks.length > 0) {
                  lastGoodTextBlocksRef.current = {
                    pageNumber,
                    blocks: nextBlocks,
                    scale: nextScale,
                  };
                }

                setBlocks(nextBlocks);
                setBlocksScale(nextScale);
                onBlocksChange?.(nextPageNumber, nextBlocks, nextScale);
              }}
              onCanvasRenderStateChange={handleCanvasTextRenderStateChange}
            />
          ) : (
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
              renderText={shouldRenderCanvasText}
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
          )}
        </div>
      ) : (
        <div
          className="absolute inset-0 z-0 border border-zinc-300 bg-white shadow-sm"
          data-knexread-page-tile-skeleton="true"
          style={{
            width: `${pageCssWidth}px`,
            height: `${pageCssHeight}px`,
          }}
        />
      )}

      {!modularPagePipelineEnabled && visualTextLayerEnabled ? (
        <div
          className="absolute inset-0 z-[5]"
          data-knexread-page-visual-text-layer-host="true"
          style={{
            width: `${pageCssWidth}px`,
            height: `${pageCssHeight}px`,
          }}
        >
          <PdfTextLayer
            blocks={textBlocksInCssSpace}
            pageNumber={pageNumber}
            highlightedBlockIds={highlightBlockIds}
            mode="visual"
          />
        </div>
      ) : null}

      {canRenderCanvas && semanticLayersEnabled ? (
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

          {shouldMountInvisibleTextLayer ? (
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
      </PdfPageComposition>
    </div>
  );
}
