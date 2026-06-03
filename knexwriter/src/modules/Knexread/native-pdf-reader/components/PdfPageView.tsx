"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
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
import { usePdfZoomFramePolicy } from "../../core/interaction/zoom-scroll";

type PdfPageBaseSize = {
  width: number;
  height: number;
};

type PdfPageRenderBand = "active" | "warmup" | "prefetch" | "idle";

const FALLBACK_PAGE_WIDTH_PT = 612;
const FALLBACK_PAGE_HEIGHT_PT = 792;
const MIN_LAYOUT_SCALE = 0.01;
const MAX_LAYOUT_SCALE = 80;

const TEXT_EXTRACTION_IDLE_DELAY_MS = 160;
const LINK_EXTRACTION_IDLE_DELAY_MS = 240;
const SELECTION_AUTOSCROLL_EDGE_PX = 96;
const SELECTION_AUTOSCROLL_MAX_STEP_PX = 28;

/*
 * A seleção precisa continuar fácil de alcançar pelo arraste, mas o
 * destaque azul não deve pintar a altura inteira da linha.
 *
 * A lógica abaixo mantém o hitRect generoso e reduz apenas o visualRect.
 */
const SELECTION_VISUAL_HEIGHT_RATIO = 0.62;
const SELECTION_VISUAL_MAX_HEIGHT_RATIO = 0.78;
const SELECTION_VISUAL_MIN_HEIGHT_PX = 6;
const SELECTION_VISUAL_VERTICAL_NUDGE_PX = 0;

/**
 * A camada textual vetorial deve ser extraída em uma escala estável.
 *
 * Não extraímos texto no zoom atual, porque isso prende os blocos ao zoom
 * e faz o texto aparecer/desaparecer quando blocksScale deixa de bater com
 * layoutScale.
 */
const TEXT_LAYER_BASE_SCALE = 1;
const PAGEVIEW_AUDIT_VERSION = "blueprint-default-016-scroll-zoom-interaction-freeze";
const PAGEVIEW_CANVAS_TEXT_SUPPRESSION_SENTINEL =
  "blueprint-default-002-no-canvas-text";
const PAGEVIEW_GLOBAL_FLAG_SYNC_MS = 1500;

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

function getRenderedPageStableSignature(
  page: RenderedPdfPage | null,
): string {
  if (!page) return "";

  const geometry = page.geometry;

  return [
    page.pageNumber,
    Math.round(safeNumber(page.width, 0) * 100) / 100,
    Math.round(safeNumber(page.height, 0) * 100) / 100,
    Math.round(safeNumber(page.cssWidth, 0) * 100) / 100,
    Math.round(safeNumber(page.cssHeight, 0) * 100) / 100,
    Math.round(safeNumber(page.renderScale, 0) * 10000) / 10000,
    Math.round(safeNumber(page.pageWidthPt, 0) * 100) / 100,
    Math.round(safeNumber(page.pageHeightPt, 0) * 100) / 100,
    geometry ? Math.round(safeNumber(geometry.baseWidth, 0) * 100) / 100 : "",
    geometry ? Math.round(safeNumber(geometry.baseHeight, 0) * 100) / 100 : "",
    page.renderMode ?? "",
    page.textLayerMode ?? "",
  ].join("|");
}

function getTextBlocksStableSignature(
  blocks: PdfTextBlock[],
  scale: number | null | undefined,
): string {
  if (!blocks.length) return `empty:${safeNumber(scale, 0)}`;

  const first = blocks[0];
  const last = blocks[blocks.length - 1];

  return [
    blocks.length,
    Math.round(safeNumber(scale, 0) * 10000) / 10000,
    first?.id ?? "",
    last?.id ?? "",
    Math.round(safeNumber(first?.x, 0) * 10) / 10,
    Math.round(safeNumber(first?.y, 0) * 10) / 10,
    Math.round(safeNumber(last?.x, 0) * 10) / 10,
    Math.round(safeNumber(last?.y, 0) * 10) / 10,
  ].join("|");
}

function getCanvasTextRenderStateSignature(
  state: PdfTileRenderState | null,
): string {
  if (!state) return "";

  const record = state as unknown as Record<string, unknown>;

  return [
    state.pageNumber,
    String(record.renderId ?? ""),
    String(record.phase ?? ""),
    String(record.status ?? ""),
    String(record.filteredTextOperationCount ?? ""),
    String(record.totalTextOperationCount ?? ""),
  ].join("|");
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

type PdfPointerSelectionPoint = {
  clientX: number;
  clientY: number;

  /*
   * Coordenadas opcionais ancoradas na página.
   *
   * A seleção com auto-scroll precisa manter o ponto inicial preso à página,
   * não à viewport. Quando o viewer rola, o clientY antigo deixa de representar
   * o mesmo ponto do PDF. pageX/pageY resolvem isso.
   */
  pageX?: number;
  pageY?: number;
};

type PdfGeometrySelectionLine = {
  text: string;

  /*
   * Hit rect: caixa usada para decidir se a linha foi alcançada pelo arrasto.
   * Mantemos esta caixa mais generosa, baseada no outer span, para que o texto
   * continue "ativo" mesmo quando a largura natural da fonte HTML diverge um
   * pouco do canvas.
   */
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  pageLeft: number;
  pageTop: number;

  /*
   * Visual rect: caixa usada para pintar overlay/seleção e para registrar os
   * rects da seleção. Esta caixa é mais conservadora e tenta respeitar a
   * largura real do texto interno.
   */
  visualPageLeft: number;
  visualPageTop: number;
  visualWidth: number;
  visualHeight: number;

  columnIndex: number;
  flowIndex: number;
};

type PdfGeometrySelectionPreviewRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function normalizeGeometrySelectionPreviewRects(
  rects: Array<Record<string, number>> | undefined,
): PdfGeometrySelectionPreviewRect[] {
  if (!rects?.length) return [];

  return rects
    .map((rect) => ({
      x: safeNumber(rect.x ?? rect.left, 0),
      y: safeNumber(rect.y ?? rect.top, 0),
      width: Math.max(1, safeNumber(rect.width, 0)),
      height: Math.max(1, safeNumber(rect.height, 0)),
    }))
    .filter((rect) => rect.width > 0 && rect.height > 0);
}

function normalizeDomText(value: string | null | undefined): string {
  return (value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function getNormalizedClientRect(
  start: PdfPointerSelectionPoint,
  end: PdfPointerSelectionPoint,
): DOMRect {
  const left = Math.min(start.clientX, end.clientX);
  const top = Math.min(start.clientY, end.clientY);
  const right = Math.max(start.clientX, end.clientX);
  const bottom = Math.max(start.clientY, end.clientY);

  return new DOMRect(left, top, Math.max(1, right - left), Math.max(1, bottom - top));
}

function bindPointerPointToPage(
  root: HTMLElement,
  point: PdfPointerSelectionPoint,
): PdfPointerSelectionPoint {
  const rootRect = root.getBoundingClientRect();

  return {
    clientX: point.clientX,
    clientY: point.clientY,
    pageX: point.clientX - rootRect.left,
    pageY: point.clientY - rootRect.top,
  };
}

function resolvePointerPointForViewport(
  root: HTMLElement,
  point: PdfPointerSelectionPoint,
): PdfPointerSelectionPoint {
  if (
    typeof point.pageX !== "number" ||
    typeof point.pageY !== "number" ||
    !Number.isFinite(point.pageX) ||
    !Number.isFinite(point.pageY)
  ) {
    return point;
  }

  const rootRect = root.getBoundingClientRect();

  return {
    ...point,
    clientX: rootRect.left + point.pageX,
    clientY: rootRect.top + point.pageY,
  };
}

type PdfSelectionScrollContainer = HTMLElement | Window;

function getSelectionScrollContainer(root: HTMLElement): PdfSelectionScrollContainer {
  let current: HTMLElement | null = root.parentElement;

  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;

    if (
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      current.scrollHeight > current.clientHeight + 2
    ) {
      return current;
    }

    current = current.parentElement;
  }

  return window;
}

function getSelectionAutoScrollDelta(input: {
  container: PdfSelectionScrollContainer;
  clientY: number;
}): number {
  const containerTop =
    input.container === window
      ? 0
      : (input.container as HTMLElement).getBoundingClientRect().top;
  const containerBottom =
    input.container === window
      ? window.innerHeight
      : (input.container as HTMLElement).getBoundingClientRect().bottom;

  const distanceToTop = input.clientY - containerTop;
  const distanceToBottom = containerBottom - input.clientY;

  if (distanceToTop >= 0 && distanceToTop < SELECTION_AUTOSCROLL_EDGE_PX) {
    const intensity =
      (SELECTION_AUTOSCROLL_EDGE_PX - distanceToTop) /
      SELECTION_AUTOSCROLL_EDGE_PX;

    return -Math.ceil(intensity * SELECTION_AUTOSCROLL_MAX_STEP_PX);
  }

  if (distanceToBottom >= 0 && distanceToBottom < SELECTION_AUTOSCROLL_EDGE_PX) {
    const intensity =
      (SELECTION_AUTOSCROLL_EDGE_PX - distanceToBottom) /
      SELECTION_AUTOSCROLL_EDGE_PX;

    return Math.ceil(intensity * SELECTION_AUTOSCROLL_MAX_STEP_PX);
  }

  return 0;
}

function scrollSelectionContainerBy(
  container: PdfSelectionScrollContainer,
  deltaY: number,
) {
  if (deltaY === 0) return;

  if (container === window) {
    window.scrollBy({ top: deltaY, left: 0, behavior: "auto" });
    return;
  }

  (container as HTMLElement).scrollTop += deltaY;
}

function doRectsIntersect(a: DOMRect, b: DOMRect): boolean {
  return (
    a.left <= b.right &&
    a.right >= b.left &&
    a.top <= b.bottom &&
    a.bottom >= b.top
  );
}

function getCompactSelectionVisualRect(input: {
  outerRect: DOMRect;
  innerRect?: DOMRect;
  visualLeft?: number;
  visualWidth?: number;
}): DOMRect {
  const outerRect = input.outerRect;
  const innerRect = input.innerRect ?? outerRect;

  const outerHeight = Math.max(1, safeNumber(outerRect.height, 1));
  const innerHeight = Math.max(1, safeNumber(innerRect.height, outerHeight));

  /*
   * A altura visual parte da linha externa, mas respeita a caixa interna
   * quando ela existe. Assim, a seleção não invade tanto o entrelinhamento
   * nem fica fina demais em PDFs com texto pequeno.
   */
  const preferredHeight = Math.min(
    outerHeight * SELECTION_VISUAL_HEIGHT_RATIO,
    innerHeight * SELECTION_VISUAL_MAX_HEIGHT_RATIO,
  );
  const minHeight = Math.min(SELECTION_VISUAL_MIN_HEIGHT_PX, outerHeight);
  const maxHeight = Math.max(
    minHeight,
    outerHeight * SELECTION_VISUAL_MAX_HEIGHT_RATIO,
  );
  const visualHeight = Math.min(
    outerHeight,
    clamp(preferredHeight, minHeight, maxHeight),
  );

  const innerCenterY = innerRect.top + innerHeight / 2;
  const outerCenterY = outerRect.top + outerHeight / 2;
  const preferredCenterY = Number.isFinite(innerCenterY)
    ? innerCenterY
    : outerCenterY;

  const visualTop = clamp(
    preferredCenterY - visualHeight / 2 + SELECTION_VISUAL_VERTICAL_NUDGE_PX,
    outerRect.top,
    outerRect.bottom - visualHeight,
  );

  const visualLeft = safeNumber(input.visualLeft, outerRect.left);
  const requestedVisualWidth = Math.max(
    1,
    safeNumber(input.visualWidth, outerRect.width),
  );
  const maxVisualWidth = Math.max(1, outerRect.right - visualLeft);
  const visualWidth = Math.min(requestedVisualWidth, maxVisualWidth);

  return new DOMRect(
    visualLeft,
    visualTop,
    visualWidth,
    Math.max(1, visualHeight),
  );
}

function buildCompactPreviewRectsFromClientRects(input: {
  root: HTMLElement;
  rects: DOMRectList;
}): PdfGeometrySelectionPreviewRect[] {
  const rootRect = input.root.getBoundingClientRect();

  return Array.from(input.rects)
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => getCompactSelectionVisualRect({ outerRect: rect }))
    .map((rect) => ({
      x: Math.max(0, rect.left - rootRect.left),
      y: Math.max(0, rect.top - rootRect.top),
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
    }))
    .filter((rect) => rect.width > 0 && rect.height > 0);
}

function buildPdfSelectionRectRecords(input: {
  pageNumber: number;
  rects: PdfGeometrySelectionPreviewRect[];
}): Array<Record<string, number>> {
  return input.rects.map((rect) => ({
    pageNumber: input.pageNumber,
    left: rect.x,
    top: rect.y,
    x: rect.x,
    y: rect.y,
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
  }));
}

function getBlueprintSelectableTextElements(root: HTMLElement): HTMLElement[] {
  const lineElements = Array.from(
    root.querySelectorAll<HTMLElement>(
      [
        "[data-knexread-blueprint-text-line='true']",
        "[data-knexread-blueprint-text-line-inner='true']",
      ].join(","),
    ),
  ).filter((element) => normalizeDomText(element.textContent).length > 0);

  if (lineElements.length > 0) {
    /*
     * Preferimos a linha externa quando ela existe, pois ela representa a
     * geometria do PDF/canvas. O inner pode ter largura natural da fonte do
     * navegador e, por isso, não é uma base confiável para retângulo.
     */
    const outerLines = lineElements.filter(
      (element) =>
        element.getAttribute("data-knexread-blueprint-text-line") === "true",
    );

    return outerLines.length > 0 ? outerLines : lineElements;
  }

  return Array.from(
    root.querySelectorAll<HTMLElement>(
      [
        "[data-knexread-blueprint-element='text']",
        "[data-knexread-html-text-run='true']",
        "[data-pdf-block-id]",
        ".knex-pdf-text-layer__span",
        ".knex-pdf-text_layer__span",
        ".textLayer span",
      ].join(","),
    ),
  ).filter((element) => normalizeDomText(element.textContent).length > 0);
}

function getElementSelectionRects(element: HTMLElement): {
  hitRect: DOMRect;
  visualRect: DOMRect;
} {
  const outerRect = element.getBoundingClientRect();
  const inner = element.querySelector<HTMLElement>(
    "[data-knexread-blueprint-text-line-inner='true']",
  );

  if (!inner) {
    return {
      hitRect: outerRect,
      visualRect: getCompactSelectionVisualRect({
        outerRect,
        innerRect: outerRect,
      }),
    };
  }

  const innerRect = inner.getBoundingClientRect();

  if (innerRect.width <= 0 || innerRect.height <= 0) {
    return {
      hitRect: outerRect,
      visualRect: getCompactSelectionVisualRect({
        outerRect,
        innerRect: outerRect,
      }),
    };
  }

  /*
   * Hit rect:
   * usa a caixa externa, porque ela está presa à geometria do PDF/canvas e
   * torna a linha inteira "ativável" pelo arrasto.
   *
   * Visual rect:
   * usa a largura conservadora do inner, mas agora reduz verticalmente o
   * destaque para pintar apenas a faixa visual do texto.
   */
  const visualLeft = Math.max(outerRect.left, innerRect.left);
  const visualRight = Math.min(outerRect.right, innerRect.right);
  const visualWidth = Math.max(1, visualRight - visualLeft);

  return {
    hitRect: outerRect,
    visualRect: getCompactSelectionVisualRect({
      outerRect,
      innerRect,
      visualLeft,
      visualWidth,
    }),
  };
}

function getLineAtPoint(
  lines: PdfGeometrySelectionLine[],
  point: PdfPointerSelectionPoint,
): PdfGeometrySelectionLine | null {
  if (!lines.length) return null;

  const directHit = lines
    .filter((line) => {
      const verticalTolerance = Math.max(4, line.height * 0.35);

      return (
        point.clientX >= line.left &&
        point.clientX <= line.right &&
        point.clientY >= line.top - verticalTolerance &&
        point.clientY <= line.bottom + verticalTolerance
      );
    })
    .sort((a, b) => a.flowIndex - b.flowIndex)[0];

  if (directHit) return directHit;

  return [...lines].sort((a, b) => {
    const aCenterX = a.left + a.width / 2;
    const aCenterY = a.top + a.height / 2;
    const bCenterX = b.left + b.width / 2;
    const bCenterY = b.top + b.height / 2;

    const aDistance =
      Math.abs(point.clientX - aCenterX) + Math.abs(point.clientY - aCenterY);
    const bDistance =
      Math.abs(point.clientX - bCenterX) + Math.abs(point.clientY - bCenterY);

    return aDistance - bDistance;
  })[0];
}

function assignColumnAndFlowIndexes(
  lines: Omit<PdfGeometrySelectionLine, "columnIndex" | "flowIndex">[],
): PdfGeometrySelectionLine[] {
  /*
   * Colunas não devem ser inferidas pela largura total da linha, porque linhas
   * longas/justificadas podem expandir a caixa e acabar tocando a coluna
   * vizinha. A separação fica mais estável quando usamos o left de início da
   * linha como assinatura da coluna.
   */
  const sortedByTop = [...lines].sort((a, b) => {
    if (Math.abs(a.top - b.top) > 4) return a.top - b.top;
    return a.left - b.left;
  });

  const columns: Array<{
    leftSamples: number[];
    center: number;
    lines: Array<Omit<PdfGeometrySelectionLine, "columnIndex" | "flowIndex">>;
  }> = [];

  for (const line of sortedByTop) {
    const lineLeft = line.left;
    const target = columns
      .map((column) => {
        const sortedSamples = [...column.leftSamples].sort((a, b) => a - b);
        const medianLeft =
          sortedSamples[Math.floor(sortedSamples.length / 2)] ?? column.center;

        return {
          column,
          distance: Math.abs(lineLeft - medianLeft),
        };
      })
      .filter(({ distance }) => distance <= Math.max(28, line.height * 2.2))
      .sort((a, b) => a.distance - b.distance)[0]?.column;

    if (target) {
      target.lines.push(line);
      target.leftSamples.push(lineLeft);
      target.center =
        target.leftSamples.reduce((sum, value) => sum + value, 0) /
        target.leftSamples.length;
      continue;
    }

    columns.push({
      leftSamples: [lineLeft],
      center: lineLeft,
      lines: [line],
    });
  }

  columns.sort((a, b) => {
    const aLeft = Math.min(...a.leftSamples);
    const bLeft = Math.min(...b.leftSamples);

    return aLeft - bLeft;
  });

  const result: PdfGeometrySelectionLine[] = [];

  for (const [columnIndex, column] of columns.entries()) {
    const columnLines = column.lines.sort((a, b) => {
      const lineTolerance = Math.max(4, Math.min(a.height, b.height) * 0.6);
      const sameLine = Math.abs(a.top - b.top) <= lineTolerance;

      if (sameLine) return a.left - b.left;
      return a.top - b.top;
    });

    for (const line of columnLines) {
      result.push({
        ...line,
        columnIndex,
        flowIndex: result.length,
      });
    }
  }

  return result;
}

function getColumnIndexes(lines: PdfGeometrySelectionLine[]): number[] {
  return [...new Set(lines.map((line) => line.columnIndex))].sort((a, b) => a - b);
}

function getColumnBounds(lines: PdfGeometrySelectionLine[], columnIndex: number) {
  const columnLines = lines.filter((line) => line.columnIndex === columnIndex);

  if (!columnLines.length) return null;

  const left = Math.min(...columnLines.map((line) => line.left));
  const right = Math.max(...columnLines.map((line) => line.right));
  const top = Math.min(...columnLines.map((line) => line.top));
  const bottom = Math.max(...columnLines.map((line) => line.bottom));

  return {
    columnIndex,
    left,
    right,
    top,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function getNearestLineByVerticalPoint(
  lines: PdfGeometrySelectionLine[],
  point: PdfPointerSelectionPoint,
): PdfGeometrySelectionLine | null {
  if (!lines.length) return null;

  const directVerticalHit = lines
    .filter((line) => {
      const verticalTolerance = Math.max(4, line.height * 0.45);

      return (
        point.clientY >= line.top - verticalTolerance &&
        point.clientY <= line.bottom + verticalTolerance
      );
    })
    .sort((a, b) => {
      const aCenterX = a.left + a.width / 2;
      const bCenterX = b.left + b.width / 2;

      return Math.abs(point.clientX - aCenterX) - Math.abs(point.clientX - bCenterX);
    })[0];

  if (directVerticalHit) return directVerticalHit;

  return [...lines].sort((a, b) => {
    const aCenterY = a.top + a.height / 2;
    const bCenterY = b.top + b.height / 2;
    const verticalDistance = Math.abs(point.clientY - aCenterY) - Math.abs(point.clientY - bCenterY);

    if (Math.abs(verticalDistance) > 0.01) return verticalDistance;

    const aCenterX = a.left + a.width / 2;
    const bCenterX = b.left + b.width / 2;

    return Math.abs(point.clientX - aCenterX) - Math.abs(point.clientX - bCenterX);
  })[0];
}

function shouldUseMultiColumnSelection(input: {
  allLines: PdfGeometrySelectionLine[];
  dragRect: DOMRect;
  startLine: PdfGeometrySelectionLine | null;
  endLine: PdfGeometrySelectionLine | null;
  start: PdfPointerSelectionPoint;
  end: PdfPointerSelectionPoint;
}): boolean {
  const columnIndexes = getColumnIndexes(input.allLines);

  if (columnIndexes.length <= 1) return false;

  const allBounds = {
    left: Math.min(...input.allLines.map((line) => line.left)),
    right: Math.max(...input.allLines.map((line) => line.right)),
  };
  const allWidth = Math.max(1, allBounds.right - allBounds.left);

  const startColumnIndex =
    input.startLine?.columnIndex ??
    inferDominantColumnFromStartPoint(input.allLines, input.start);
  const endColumnIndex =
    input.endLine?.columnIndex ??
    inferDominantColumnFromStartPoint(input.allLines, input.end);

  /*
   * Seleção de página/duas colunas:
   *
   * Só liberamos seleção multicoluna quando há intenção horizontal clara:
   * - início e fim caem em colunas diferentes; e
   * - o arrasto percorreu uma faixa horizontal suficientemente larga.
   *
   * Assim, um arrasto vertical normal na coluna esquerda não puxa a coluna
   * direita por acidente; mas um arrasto diagonal/largo para pegar a página
   * inteira seleciona as colunas em ordem de leitura.
   */
  const crossedColumn =
    typeof startColumnIndex === "number" &&
    typeof endColumnIndex === "number" &&
    startColumnIndex !== endColumnIndex;

  const horizontalTravel = Math.abs(input.end.clientX - input.start.clientX);
  const pageWideDrag = input.dragRect.width >= allWidth * 0.72;
  const intentionalCrossColumnTravel = horizontalTravel >= allWidth * 0.42;

  return crossedColumn && (pageWideDrag || intentionalCrossColumnTravel);
}

function filterLinesByColumnAwareDrag(input: {
  allLines: PdfGeometrySelectionLine[];
  dragRect: DOMRect;
  start: PdfPointerSelectionPoint;
  end: PdfPointerSelectionPoint;
}): PdfGeometrySelectionLine[] {
  if (!input.allLines.length) return [];

  const startLine = getLineAtPoint(input.allLines, input.start);
  const endLine = getLineAtPoint(input.allLines, input.end);
  const multiColumnSelection = shouldUseMultiColumnSelection({
    allLines: input.allLines,
    dragRect: input.dragRect,
    startLine,
    endLine,
    start: input.start,
    end: input.end,
  });

  if (multiColumnSelection) {
    const fallbackStartLine =
      startLine ?? getNearestLineByVerticalPoint(input.allLines, input.start);
    const fallbackEndLine =
      endLine ?? getNearestLineByVerticalPoint(input.allLines, input.end);

    if (!fallbackStartLine || !fallbackEndLine) return [];

    const minFlow = Math.min(fallbackStartLine.flowIndex, fallbackEndLine.flowIndex);
    const maxFlow = Math.max(fallbackStartLine.flowIndex, fallbackEndLine.flowIndex);

    return input.allLines.filter(
      (line) => line.flowIndex >= minFlow && line.flowIndex <= maxFlow,
    );
  }

  /*
   * Seleção contínua em uma coluna:
   *
   * Em vez de depender apenas das linhas que intersectam o retângulo bruto,
   * escolhemos a coluna de origem e selecionamos todas as linhas entre a linha
   * inicial e a linha mais próxima do ponto atual. Isso deixa a seleção fluida
   * mesmo quando o mouse desvia um pouco para o espaço em branco ou para a
   * lateral, sem atravessar para a coluna vizinha.
   */
  const dominantColumnIndex =
    startLine?.columnIndex ??
    inferDominantColumnFromStartPoint(input.allLines, input.start) ??
    endLine?.columnIndex ??
    inferDominantColumnFromIntersectedLines(
      input.allLines.filter((line) =>
        doRectsIntersect(
          input.dragRect,
          new DOMRect(line.left, line.top, line.width, line.height),
        ),
      ),
    );

  const columnLines = input.allLines.filter(
    (line) => line.columnIndex === dominantColumnIndex,
  );

  if (!columnLines.length) return [];

  const columnStartLine =
    startLine?.columnIndex === dominantColumnIndex
      ? startLine
      : getNearestLineByVerticalPoint(columnLines, input.start);
  const columnEndLine =
    endLine?.columnIndex === dominantColumnIndex
      ? endLine
      : getNearestLineByVerticalPoint(columnLines, input.end);

  if (!columnStartLine || !columnEndLine) return [];

  const minFlow = Math.min(columnStartLine.flowIndex, columnEndLine.flowIndex);
  const maxFlow = Math.max(columnStartLine.flowIndex, columnEndLine.flowIndex);

  return columnLines.filter(
    (line) => line.flowIndex >= minFlow && line.flowIndex <= maxFlow,
  );
}

function inferDominantColumnFromStartPoint(
  lines: PdfGeometrySelectionLine[],
  point: PdfPointerSelectionPoint,
): number | null {
  if (!lines.length) return null;

  const columnStats = new Map<
    number,
    {
      minLeft: number;
      maxRight: number;
      centerSum: number;
      count: number;
    }
  >();

  for (const line of lines) {
    const current =
      columnStats.get(line.columnIndex) ?? {
        minLeft: Number.POSITIVE_INFINITY,
        maxRight: Number.NEGATIVE_INFINITY,
        centerSum: 0,
        count: 0,
      };

    current.minLeft = Math.min(current.minLeft, line.left);
    current.maxRight = Math.max(current.maxRight, line.right);
    current.centerSum += line.left + line.width / 2;
    current.count += 1;

    columnStats.set(line.columnIndex, current);
  }

  const directColumn = [...columnStats.entries()]
    .filter(([, stats]) => {
      const tolerance = Math.max(16, (stats.maxRight - stats.minLeft) * 0.04);

      return (
        point.clientX >= stats.minLeft - tolerance &&
        point.clientX <= stats.maxRight + tolerance
      );
    })
    .sort((a, b) => {
      const aCenter = a[1].centerSum / Math.max(1, a[1].count);
      const bCenter = b[1].centerSum / Math.max(1, b[1].count);

      return Math.abs(point.clientX - aCenter) - Math.abs(point.clientX - bCenter);
    })[0]?.[0];

  if (typeof directColumn === "number") return directColumn;

  return [...columnStats.entries()]
    .sort((a, b) => {
      const aCenter = a[1].centerSum / Math.max(1, a[1].count);
      const bCenter = b[1].centerSum / Math.max(1, b[1].count);

      return Math.abs(point.clientX - aCenter) - Math.abs(point.clientX - bCenter);
    })[0]?.[0] ?? null;
}

function inferDominantColumnFromIntersectedLines(
  lines: PdfGeometrySelectionLine[],
): number {
  const counts = new Map<number, number>();

  for (const line of lines) {
    counts.set(line.columnIndex, (counts.get(line.columnIndex) ?? 0) + 1);
  }

  return (
    [...counts.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0] - b[0];
    })[0]?.[0] ?? 0
  );
}

function buildGeometrySelectionAnchor(input: {
  pageNumber: number;
  selectedText: string;
  rects: Array<Record<string, number>>;
  selectedBlockIds: string[];
}) {
  const firstRect = input.rects[0];
  const lastRect = input.rects[input.rects.length - 1] ?? firstRect;

  return {
    pageNumber: input.pageNumber,
    selectedText: input.selectedText,
    normalizedText: normalizeDomText(input.selectedText).toLowerCase(),
    blockIds: input.selectedBlockIds,
    startBlockId: input.selectedBlockIds[0],
    endBlockId: input.selectedBlockIds[input.selectedBlockIds.length - 1],
    start: firstRect
      ? {
          x: firstRect.left ?? firstRect.x ?? 0,
          y: firstRect.top ?? firstRect.y ?? 0,
        }
      : undefined,
    end: lastRect
      ? {
          x: (lastRect.left ?? lastRect.x ?? 0) + (lastRect.width ?? 0),
          y: (lastRect.top ?? lastRect.y ?? 0) + (lastRect.height ?? 0),
        }
      : undefined,
  };
}

function buildPdfGeometrySelectionFromDrag(input: {
  root: HTMLElement;
  pageNumber: number;
  pageBlocks: PdfTextBlock[];
  start: PdfPointerSelectionPoint | null;
  end: PdfPointerSelectionPoint;
}): PdfTextSelection | null {
  if (!input.start) return null;

  const resolvedStart = resolvePointerPointForViewport(input.root, input.start);
  const resolvedEnd = resolvePointerPointForViewport(input.root, input.end);
  const dragRect = getNormalizedClientRect(resolvedStart, resolvedEnd);

  /*
   * Clique simples não deve abrir toolbar de seleção. Exigimos arrasto mínimo.
   */
  if (dragRect.width < 3 && dragRect.height < 3) return null;

  const pageRect = input.root.getBoundingClientRect();
  const candidates = getBlueprintSelectableTextElements(input.root);
  const allLinesWithoutFlow: Array<
    Omit<PdfGeometrySelectionLine, "columnIndex" | "flowIndex">
  > = [];
  const seen = new Set<string>();

  for (const element of candidates) {
    const text = normalizeDomText(element.textContent);
    if (!text) continue;

    const { hitRect, visualRect } = getElementSelectionRects(element);
    if (hitRect.width <= 0 || hitRect.height <= 0) continue;

    const pageLeft = Math.max(0, hitRect.left - pageRect.left);
    const pageTop = Math.max(0, hitRect.top - pageRect.top);
    const visualPageLeft = Math.max(0, visualRect.left - pageRect.left);
    const visualPageTop = Math.max(0, visualRect.top - pageRect.top);

    const key = [
      Math.round(pageTop * 2) / 2,
      Math.round(pageLeft * 2) / 2,
      Math.round(hitRect.width * 2) / 2,
      text.toLowerCase(),
    ].join("|");

    if (seen.has(key)) continue;
    seen.add(key);

    allLinesWithoutFlow.push({
      text,
      left: hitRect.left,
      top: hitRect.top,
      right: hitRect.right,
      bottom: hitRect.bottom,
      width: hitRect.width,
      height: hitRect.height,
      pageLeft,
      pageTop,
      visualPageLeft,
      visualPageTop,
      visualWidth: Math.max(1, visualRect.width),
      visualHeight: Math.max(1, visualRect.height),
    });
  }

  if (allLinesWithoutFlow.length === 0) return null;

  const allLines = assignColumnAndFlowIndexes(allLinesWithoutFlow);
  const selectedLines = filterLinesByColumnAwareDrag({
    allLines,
    dragRect,
    start: input.start,
    end: input.end,
  });

  if (selectedLines.length === 0) return null;

  selectedLines.sort((a, b) => a.flowIndex - b.flowIndex);

  const selectedText = selectedLines
    .map((line) => line.text)
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!selectedText) return null;

  const rects = selectedLines.map((line) => ({
    pageNumber: input.pageNumber,
    left: line.visualPageLeft,
    top: line.visualPageTop,
    x: line.visualPageLeft,
    y: line.visualPageTop,
    width: Math.max(1, line.visualWidth),
    height: Math.max(1, line.visualHeight),
  }));

  const selectedBlockIds = input.pageBlocks
    .filter((block) =>
      rects.some((rect) => {
        const blockRect = new DOMRect(
          block.x,
          block.y,
          Math.max(1, block.width),
          Math.max(1, block.height),
        );
        const selectionRect = new DOMRect(
          rect.left,
          rect.top,
          rect.width,
          rect.height,
        );

        return doRectsIntersect(blockRect, selectionRect);
      }),
    )
    .map((block) => block.id);

  return {
    pageNumber: input.pageNumber,
    selectedText,
    rects,
    anchor: buildGeometrySelectionAnchor({
      pageNumber: input.pageNumber,
      selectedText,
      rects,
      selectedBlockIds,
    }),
  } as unknown as PdfTextSelection;
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
  visualZoom,
  renderZoom,
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

  /**
   * Zoom visual/interativo.
   *
   * Muda imediatamente durante wheel/zoom e controla layout, tamanho visual da
   * página, overlays e sensação de resposta.
   */
  visualZoom?: number;

  /**
   * Zoom de renderização pesada.
   *
   * Só deve mudar depois que o gesto estabiliza. É usado para canvas/tiles,
   * cacheKey, renderIdentity e geração real da imagem.
   */
  renderZoom?: number;

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
  const pointerSelectionStartRef = useRef<PdfPointerSelectionPoint | null>(null);
  const latestSelectionPointerRef = useRef<PdfPointerSelectionPoint | null>(null);
  const selectionPreviewFrameRef = useRef<number | null>(null);
  const selectionAutoScrollFrameRef = useRef<number | null>(null);
  const lastGeometrySelectionPreviewSignatureRef = useRef("");
  const textExtractionTicketRef = useRef(0);
  const linkExtractionTicketRef = useRef(0);
  const lastGoodTextBlocksRef = useRef<{
    pageNumber: number;
    blocks: PdfTextBlock[];
    scale: number;
  } | null>(null);
  const lastRenderedPageSignatureRef = useRef("");
  const lastCanvasTextRenderStateSignatureRef = useRef("");
  const lastModularTextBlocksSignatureRef = useRef("");

  const [renderedPage, setRenderedPage] = useState<RenderedPdfPage | null>(null);
  const [blocks, setBlocks] = useState<PdfTextBlock[]>([]);
  const [blocksScale, setBlocksScale] = useState<number | null>(null);
  const [canvasTextRenderState, setCanvasTextRenderState] =
    useState<PdfTileRenderState | null>(null);
  const [links, setLinks] = useState<PdfPageLinkAnnotation[]>([]);
  const [geometrySelectionPreviewRects, setGeometrySelectionPreviewRects] =
    useState<PdfGeometrySelectionPreviewRect[]>([]);
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

  const effectiveVisualZoom = useMemo(
    () => Math.max(MIN_LAYOUT_SCALE * 100, safeNumber(visualZoom, zoom)),
    [visualZoom, zoom],
  );

  const effectiveRenderZoom = useMemo(
    () => Math.max(MIN_LAYOUT_SCALE * 100, safeNumber(renderZoom, zoom)),
    [renderZoom, zoom],
  );

  const isViewportMoving = isZooming || isScrolling;

  const visualToRenderScaleRatio = useMemo(() => {
    const render = Math.max(MIN_LAYOUT_SCALE * 100, effectiveRenderZoom);
    return effectiveVisualZoom / render;
  }, [effectiveRenderZoom, effectiveVisualZoom]);

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

  const zoomFrame = usePdfZoomFramePolicy({
    zoom: effectiveVisualZoom,
    basePageSize,
    renderPhase,
    isZooming,
    isScrolling,
    isWarmupPage,
    showTextLayer,
    enableSelection,
    modularPagePipelineEnabled,
    blueprintPagePipelineEnabled,
    minLayoutScale: MIN_LAYOUT_SCALE,
    maxLayoutScale: MAX_LAYOUT_SCALE,
  });

  const layoutScale = zoomFrame.layoutScale;
  const pageCssWidth = zoomFrame.pageCssWidth;
  const pageCssHeight = zoomFrame.pageCssHeight;

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
    (!isViewportMoving || isActivePage || priority) &&
    (shouldMountCanvasNow ||
      isActivePage ||
      isWarmupPage ||
      isNearViewport ||
      priority ||
      isPreloadRender);

  /*
   * Política centralizada em core/interaction/zoom-scroll.
   *
   * A camada visual de texto não deve ser desmontada durante zoom/scroll.
   * Apenas seleção, links, highlights e toolbar ficam suspensos enquanto a
   * interação está em andamento.
   */
  const semanticLayersEnabled = zoomFrame.pageSemanticDataAvailable;
  const interactionLayersEnabled = zoomFrame.canInteractWithText;
  const effectiveShowTextLayer = zoomFrame.canPresentVisualText;

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
    zoomFrame.canUseNativeSelection &&
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
    !isViewportMoving &&
    !modularPagePipelineEnabled &&
    zoomFrame.canRenderHighlights &&
    canRenderCanvas &&
    (isActivePage || isNearViewport || isWarmupPage || priority) &&
    (effectiveShowTextLayer || Boolean(onBlocksChange));
  const shouldExtractLinks =
    !isViewportMoving &&
    zoomFrame.canRenderLinks &&
    canRenderCanvas &&
    (isActivePage || isNearViewport || priority);

  const nearViewportRootMargin = useMemo(() => {
    const movingMargin =
      engineState.activeBackend === "pdfjs"
        ? "1200px 0px 1200px 0px"
        : "1000px 0px 1000px 0px";

    if (isViewportMoving) {
      return movingMargin;
    }

    return engineState.activeBackend === "pdfjs"
      ? "3200px 0px 3200px 0px"
      : "3000px 0px 3000px 0px";
  }, [engineState.activeBackend, isViewportMoving]);

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
    }, 800);

    return () => {
      window.clearTimeout(releaseTimer);
    };
  }, [isScrolling, isZooming, shouldMountCanvasNow]);

  useEffect(() => {
    setCanvasTextRenderState(null);
  }, [pageNumber, session]);

  useEffect(() => {
    setGeometrySelectionPreviewRects((current) =>
      current.length === 0 ? current : [],
    );
  }, [isScrolling, isZooming, pageNumber, renderPhase]);

  useEffect(() => {
    if (!zoomFrame.shouldClearNativeSelection) return;

    window.getSelection()?.removeAllRanges();
  }, [zoomFrame.shouldClearNativeSelection]);

  useEffect(() => {
    const syncDebugOverlay = () => {
      setDebugOverlayEnabled(isKnexPdfPageDebugEnabled());
    };

    syncDebugOverlay();

    const intervalId = window.setInterval(syncDebugOverlay, PAGEVIEW_GLOBAL_FLAG_SYNC_MS);

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

    const intervalId = window.setInterval(syncVisualTextFlags, PAGEVIEW_GLOBAL_FLAG_SYNC_MS);

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

    const intervalId = window.setInterval(syncModularPipelineFlag, PAGEVIEW_GLOBAL_FLAG_SYNC_MS);

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

    const intervalId = window.setInterval(syncBlueprintPipelineFlag, PAGEVIEW_GLOBAL_FLAG_SYNC_MS);

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
        const nextNearViewport = Boolean(entry?.isIntersecting);

        setIsNearViewport((current) =>
          current === nextNearViewport ? current : nextNearViewport,
        );
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
      effectiveVisualZoom,
      effectiveRenderZoom,
      visualToRenderScaleRatio,
      modularPagePipelineEnabled,
      blueprintPagePipelineEnabled,
      pageRenderMode,
      visualTextLayerEnabled,
      zoomFramePolicy: {
        pageSemanticDataAvailable: zoomFrame.pageSemanticDataAvailable,
        canPresentVisualText: zoomFrame.canPresentVisualText,
        canInteractWithText: zoomFrame.canInteractWithText,
        canUseNativeSelection: zoomFrame.canUseNativeSelection,
        shouldUseGeometrySelection: zoomFrame.shouldUseGeometrySelection,
      },
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
    effectiveRenderZoom,
    effectiveVisualZoom,
    visualToRenderScaleRatio,
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
    zoomFrame.canInteractWithText,
    zoomFrame.canPresentVisualText,
    zoomFrame.canUseNativeSelection,
    zoomFrame.pageSemanticDataAvailable,
    zoomFrame.shouldUseGeometrySelection,
  ]);

  const handleRendered = useCallback(
    (page: RenderedPdfPage) => {
      const nextSignature = getRenderedPageStableSignature(page);

      if (nextSignature === lastRenderedPageSignatureRef.current) {
        return;
      }

      lastRenderedPageSignatureRef.current = nextSignature;
      setRenderedPage(page);
      onRendered?.(page);
    },
    [onRendered],
  );

  const handleCanvasTextRenderStateChange = useCallback(
    (state: PdfTileRenderState) => {
      if (state.pageNumber !== pageNumber) return;

      if (isViewportMoving && !debugOverlayEnabled) {
        return;
      }

      const nextSignature = getCanvasTextRenderStateSignature(state);

      if (nextSignature === lastCanvasTextRenderStateSignatureRef.current) {
        return;
      }

      lastCanvasTextRenderStateSignatureRef.current = nextSignature;
      setCanvasTextRenderState(state);
    },
    [debugOverlayEnabled, isViewportMoving, pageNumber],
  );

  const handleModularTextBlocksChange = useCallback(
    (nextPageNumber: number, nextBlocks: PdfTextBlock[], nextScale: number) => {
      if (nextPageNumber !== pageNumber) return;

      if (nextBlocks.length > 0) {
        lastGoodTextBlocksRef.current = {
          pageNumber,
          blocks: nextBlocks,
          scale: nextScale,
        };
      }

      const nextSignature = getTextBlocksStableSignature(nextBlocks, nextScale);

      if (nextSignature === lastModularTextBlocksSignatureRef.current) {
        return;
      }

      lastModularTextBlocksSignatureRef.current = nextSignature;

      /*
       * Durante scroll/zoom, não empurramos blocos para estado local nem para
       * o Shell. O Shell persiste blocos e recalcula camadas; isso pode travar
       * a rolagem. Mantemos o último conjunto bom e deixamos a nova emissão ser
       * aplicada quando a interação estabilizar.
       */
      if (isViewportMoving) {
        return;
      }

      setBlocks(nextBlocks);
      setBlocksScale(nextScale);
      onBlocksChange?.(nextPageNumber, nextBlocks, nextScale);
    },
    [isViewportMoving, onBlocksChange, pageNumber],
  );

  const highlightBlockIds = useMemo(() => {
    if (!highlights.length || !blocks.length || !zoomFrame.canRenderHighlights) {
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
  }, [blocks, highlights, pageNumber, zoomFrame.canRenderHighlights]);

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!interactionLayersEnabled || event.button !== 0) {
        pointerSelectionStartRef.current = null;
        return;
      }

      if (zoomFrame.shouldUseGeometrySelection) {
        event.preventDefault();
        window.getSelection()?.removeAllRanges();
      }

      const root = rootRef.current;

      setGeometrySelectionPreviewRects([]);
      lastGeometrySelectionPreviewSignatureRef.current = "";
      latestSelectionPointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      };

      pointerSelectionStartRef.current = root
        ? bindPointerPointToPage(root, {
            clientX: event.clientX,
            clientY: event.clientY,
          })
        : {
            clientX: event.clientX,
            clientY: event.clientY,
          };
    },
    [interactionLayersEnabled, zoomFrame.shouldUseGeometrySelection],
  );

  const finishGeometrySelectionFallback = useCallback(
    (input: PdfPointerSelectionPoint) => {
      if (!interactionLayersEnabled) {
        pointerSelectionStartRef.current = null;
        return false;
      }

      const root = rootRef.current;
      if (!root) {
        pointerSelectionStartRef.current = null;
        return false;
      }

      const geometrySelection = buildPdfGeometrySelectionFromDrag({
        root,
        pageNumber,
        pageBlocks: blocks,
        start: pointerSelectionStartRef.current,
        end: input,
      });

      pointerSelectionStartRef.current = null;
      latestSelectionPointerRef.current = null;

      if (!geometrySelection) return false;

      window.getSelection()?.removeAllRanges();

      const lastRect =
        geometrySelection.rects?.[geometrySelection.rects.length - 1];

      const rootRect = root.getBoundingClientRect();
      const position = lastRect
        ? {
            top:
              rootRect.top +
              window.scrollY +
              lastRect.y +
              lastRect.height +
              8,
            left: rootRect.left + window.scrollX + lastRect.x,
          }
        : {
            top: input.clientY + window.scrollY + 8,
            left: input.clientX + window.scrollX,
          };

      setGeometrySelectionPreviewRects(
        normalizeGeometrySelectionPreviewRects(
          geometrySelection.rects as unknown as Array<Record<string, number>>,
        ),
      );

      if (getGlobalBoolean("KNEX_PDF_DEBUG_SELECTION")) {
        // eslint-disable-next-line no-console
        console.debug("[KnexRead][GeometrySelectionFallback]", {
          pageNumber,
          selectedText: geometrySelection.selectedText,
          rectCount: geometrySelection.rects?.length ?? 0,
          position,
        });
      }

      onSelectText(geometrySelection, position);
      return true;
    },
    [
      blocks,
      interactionLayersEnabled,
      onSelectText,
      pageNumber,
    ],
  );

  const updateGeometrySelectionPreview = useCallback(
    (input: PdfPointerSelectionPoint) => {
      if (!interactionLayersEnabled) {
        return;
      }

      const root = rootRef.current;
      const start = pointerSelectionStartRef.current;

      if (!root || !start) return;

      const geometrySelection = buildPdfGeometrySelectionFromDrag({
        root,
        pageNumber,
        pageBlocks: blocks,
        start,
        end: input,
      });

      const nextRects = geometrySelection
        ? normalizeGeometrySelectionPreviewRects(
            geometrySelection.rects as unknown as Array<Record<string, number>>,
          )
        : [];
      const nextSignature = nextRects
        .map((rect) =>
          [
            Math.round(rect.x),
            Math.round(rect.y),
            Math.round(rect.width),
            Math.round(rect.height),
          ].join(":"),
        )
        .join("|");

      if (nextSignature !== lastGeometrySelectionPreviewSignatureRef.current) {
        lastGeometrySelectionPreviewSignatureRef.current = nextSignature;
        setGeometrySelectionPreviewRects(nextRects);
      }
    },
    [
      blocks,
      interactionLayersEnabled,
      pageNumber,
    ],
  );

  const stopSelectionAutoScroll = useCallback(() => {
    if (selectionAutoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(selectionAutoScrollFrameRef.current);
      selectionAutoScrollFrameRef.current = null;
    }
  }, []);

  const stopSelectionPreviewFrame = useCallback(() => {
    if (selectionPreviewFrameRef.current !== null) {
      window.cancelAnimationFrame(selectionPreviewFrameRef.current);
      selectionPreviewFrameRef.current = null;
    }
  }, []);

  const scheduleGeometrySelectionPreview = useCallback(
    (point: PdfPointerSelectionPoint) => {
      latestSelectionPointerRef.current = point;

      if (selectionPreviewFrameRef.current !== null) return;

      selectionPreviewFrameRef.current = window.requestAnimationFrame(() => {
        selectionPreviewFrameRef.current = null;

        const latestPoint = latestSelectionPointerRef.current;
        if (!latestPoint || !pointerSelectionStartRef.current) return;

        updateGeometrySelectionPreview(latestPoint);
      });
    },
    [updateGeometrySelectionPreview],
  );

  const scheduleSelectionAutoScroll = useCallback(
    (point: PdfPointerSelectionPoint) => {
      const root = rootRef.current;

      if (!root || !pointerSelectionStartRef.current) {
        stopSelectionAutoScroll();
        return;
      }

      latestSelectionPointerRef.current = point;

      const container = getSelectionScrollContainer(root);
      const initialDelta = getSelectionAutoScrollDelta({
        container,
        clientY: point.clientY,
      });

      if (initialDelta === 0) {
        stopSelectionAutoScroll();
        return;
      }

      if (selectionAutoScrollFrameRef.current !== null) return;

      const tick = () => {
        const activeRoot = rootRef.current;
        const latestPoint = latestSelectionPointerRef.current;

        if (!activeRoot || !pointerSelectionStartRef.current || !latestPoint) {
          selectionAutoScrollFrameRef.current = null;
          return;
        }

        const activeContainer = getSelectionScrollContainer(activeRoot);
        const deltaY = getSelectionAutoScrollDelta({
          container: activeContainer,
          clientY: latestPoint.clientY,
        });

        if (deltaY === 0) {
          selectionAutoScrollFrameRef.current = null;
          return;
        }

        scrollSelectionContainerBy(activeContainer, deltaY);
        scheduleGeometrySelectionPreview(latestPoint);

        selectionAutoScrollFrameRef.current = window.requestAnimationFrame(tick);
      };

      selectionAutoScrollFrameRef.current = window.requestAnimationFrame(tick);
    },
    [scheduleGeometrySelectionPreview, stopSelectionAutoScroll],
  );

  const handleMouseUp = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!interactionLayersEnabled) {
        pointerSelectionStartRef.current = null;
        return;
      }

      const root = rootRef.current;
      if (!root) {
        pointerSelectionStartRef.current = null;
        return;
      }

      const selection = window.getSelection();

      if (
        zoomFrame.canUseNativeSelection &&
        selection &&
        !selection.isCollapsed &&
        selection.rangeCount > 0
      ) {
        const range = selection.getRangeAt(0);

        if (root.contains(range.commonAncestorContainer)) {
          const capturedSelection = capturePdfSelectionFromRange({
            pageNumber,
            pageBlocks: blocks,
            range,
            pageElement: root,
          });

          if (capturedSelection) {
            const rects = range.getClientRects();
            const lastRect =
              rects.item(rects.length - 1) ?? range.getBoundingClientRect();

            const position = {
              top: lastRect.bottom + window.scrollY + 8,
              left: lastRect.left + window.scrollX,
            };

            const compactPreviewRects = buildCompactPreviewRectsFromClientRects({
              root,
              rects,
            });
            setGeometrySelectionPreviewRects(compactPreviewRects);

            const compactCapturedSelection = compactPreviewRects.length > 0
              ? ({
                  ...capturedSelection,
                  rects: buildPdfSelectionRectRecords({
                    pageNumber,
                    rects: compactPreviewRects,
                  }),
                } as unknown as PdfTextSelection)
              : capturedSelection;

            pointerSelectionStartRef.current = null;
            latestSelectionPointerRef.current = null;
            window.getSelection()?.removeAllRanges();
            onSelectText(compactCapturedSelection, position);
            return;
          }
        }
      }

      /*
       * Fallback geométrico:
       *
       * Em alguns PDFs/pipelines o browser cria range nativo vazio porque o
       * caret cai no DIV da página, mesmo com texto HTML transparente montado.
       * Nesses casos, capturamos a seleção pelo retângulo de arrasto e pelas
       * linhas do blueprint, preservando canvas como visual e HTML como base
       * semântica.
       */
      finishGeometrySelectionFallback({
        clientX: event.clientX,
        clientY: event.clientY,
      });
    },
    [
      blocks,
      finishGeometrySelectionFallback,
      interactionLayersEnabled,
      onSelectText,
      pageNumber,
      zoomFrame.canUseNativeSelection,
    ],
  );


  useEffect(() => {
    const shouldStartDocumentSelection = (event: MouseEvent) => {
      if (!interactionLayersEnabled || event.button !== 0) {
        return false;
      }

      const root = rootRef.current;
      const target = event.target;

      return Boolean(
        root &&
          target instanceof Node &&
          root.contains(target),
      );
    };

    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (!shouldStartDocumentSelection(event)) {
        /*
         * O botão direito não deve limpar seleção, pois será usado pelo menu
         * contextual do Knexread.
         */
        if (event.button === 0) {
          pointerSelectionStartRef.current = null;
          latestSelectionPointerRef.current = null;
          stopSelectionAutoScroll();
          stopSelectionPreviewFrame();
        }

        return;
      }

      if (zoomFrame.shouldUseGeometrySelection) {
        event.preventDefault();
        window.getSelection()?.removeAllRanges();
      }

      const root = rootRef.current;

      setGeometrySelectionPreviewRects([]);
      lastGeometrySelectionPreviewSignatureRef.current = "";
      latestSelectionPointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      };

      pointerSelectionStartRef.current = root
        ? bindPointerPointToPage(root, {
            clientX: event.clientX,
            clientY: event.clientY,
          })
        : {
            clientX: event.clientX,
            clientY: event.clientY,
          };
    };

    const handleDocumentMouseMove = (event: MouseEvent) => {
      if (!pointerSelectionStartRef.current) return;

      const point = {
        clientX: event.clientX,
        clientY: event.clientY,
      };

      if (zoomFrame.shouldUseGeometrySelection) {
        scheduleGeometrySelectionPreview(point);
        scheduleSelectionAutoScroll(point);
      }
    };

    const handleDocumentMouseUp = (event: MouseEvent) => {
      if (!pointerSelectionStartRef.current) return;

      stopSelectionAutoScroll();
      stopSelectionPreviewFrame();

      if (zoomFrame.canUseNativeSelection) {
        const root = rootRef.current;
        const selection = window.getSelection();

        if (
          root &&
          selection &&
          !selection.isCollapsed &&
          selection.rangeCount > 0 &&
          root.contains(selection.getRangeAt(0).commonAncestorContainer)
        ) {
          pointerSelectionStartRef.current = null;
          latestSelectionPointerRef.current = null;
          return;
        }
      }

      finishGeometrySelectionFallback({
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };

    const handleDocumentBlur = () => {
      pointerSelectionStartRef.current = null;
      latestSelectionPointerRef.current = null;
      stopSelectionAutoScroll();
      stopSelectionPreviewFrame();
      setGeometrySelectionPreviewRects([]);
      lastGeometrySelectionPreviewSignatureRef.current = "";
    };

    /*
     * Captura no document:
     *
     * O teste de console confirmou que a seleção geométrica funciona quando
     * ouvimos mousedown/mouseup no document em capture. Alguns wrappers internos
     * do leitor podem impedir que o mousedown/mouseup chegue ao React no root da
     * página. Por isso o document agora inicia e fecha o arrasto, mas somente
     * quando o alvo pertence a esta página.
     */
    document.addEventListener("mousedown", handleDocumentMouseDown, true);
    document.addEventListener("mousemove", handleDocumentMouseMove, true);
    document.addEventListener("mouseup", handleDocumentMouseUp, true);
    window.addEventListener("blur", handleDocumentBlur);

    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown, true);
      document.removeEventListener("mousemove", handleDocumentMouseMove, true);
      document.removeEventListener("mouseup", handleDocumentMouseUp, true);
      window.removeEventListener("blur", handleDocumentBlur);
      stopSelectionAutoScroll();
      stopSelectionPreviewFrame();
    };
  }, [
    finishGeometrySelectionFallback,
    interactionLayersEnabled,
    scheduleGeometrySelectionPreview,
    scheduleSelectionAutoScroll,
    stopSelectionAutoScroll,
    stopSelectionPreviewFrame,
    zoomFrame.canUseNativeSelection,
    zoomFrame.shouldUseGeometrySelection,
  ]);

  const handleLinkClick = useCallback(
    async (link: PdfPageLinkAnnotation) => {
      if (!zoomFrame.canRenderLinks) return;

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
    [onNavigateToPage, session, zoomFrame.canRenderLinks],
  );

  return (
    <div
      ref={rootRef}
      className="relative block shrink-0"
      onMouseDownCapture={handleMouseDown}
      onMouseUpCapture={handleMouseUp}
      data-knexread-pageview-audit-version={PAGEVIEW_AUDIT_VERSION}
      data-knexread-pageview-canvas-text-sentinel={
        PAGEVIEW_CANVAS_TEXT_SUPPRESSION_SENTINEL
      }
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
      data-knexread-page-can-present-visual-text={
        zoomFrame.canPresentVisualText ? "true" : "false"
      }
      data-knexread-page-can-interact-with-text={
        zoomFrame.canInteractWithText ? "true" : "false"
      }
      data-knexread-page-native-selection={
        zoomFrame.canUseNativeSelection ? "true" : "false"
      }
      data-knexread-page-geometry-selection={
        zoomFrame.shouldUseGeometrySelection ? "true" : "false"
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
      data-knexread-page-visual-zoom={effectiveVisualZoom}
      data-knexread-page-render-zoom={effectiveRenderZoom}
      data-knexread-page-visual-to-render-scale-ratio={visualToRenderScaleRatio}
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
        cursor: interactionLayersEnabled ? "text" : "default",
        userSelect: "none",
        WebkitUserSelect: "none",
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
          data-knexread-page-raster-visual-zoom={effectiveVisualZoom}
          data-knexread-page-raster-render-zoom={effectiveRenderZoom}
          data-knexread-page-raster-visual-to-render-scale-ratio={
            visualToRenderScaleRatio
          }
          data-knexread-page-modular-stage-zoom={
            modularPagePipelineEnabled ? effectiveVisualZoom : ""
          }
          data-knexread-page-tiled-render-zoom={
            !modularPagePipelineEnabled ? effectiveRenderZoom : ""
          }
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
              zoom={effectiveRenderZoom}
              visualZoom={effectiveVisualZoom}
              renderZoom={effectiveRenderZoom}
              pageCssWidth={pageCssWidth}
              pageCssHeight={pageCssHeight}
              renderQuality={effectiveCanvasRenderQuality}
              onRendered={handleRendered}
              renderPhase={renderPhase}
              finalRenderVersion={canvasRenderVersion}
              highlightedRunIds={highlightBlockIds}
              onTextBlocksChange={handleModularTextBlocksChange}
              onCanvasRenderStateChange={handleCanvasTextRenderStateChange}
            />
          ) : (
            <PdfTiledPageCanvas
              session={session}
              pdfFileId={pdfFileId}
              pageNumber={pageNumber}
              zoom={effectiveRenderZoom}
              visualZoom={effectiveVisualZoom}
              renderZoom={effectiveRenderZoom}
              visualToRenderScaleRatio={visualToRenderScaleRatio}
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

      {canRenderCanvas &&
      (zoomFrame.canRenderHighlights ||
        zoomFrame.canRenderLinks ||
        shouldMountInvisibleTextLayer) ? (
        <>
          {zoomFrame.canRenderHighlights ? (
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

          {zoomFrame.canRenderLinks ? (
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

      {geometrySelectionPreviewRects.length > 0 ? (
        <div
          className="absolute inset-0 z-30 pointer-events-none"
          data-knexread-page-geometry-selection-overlay="true"
          data-knexread-page-geometry-selection-rect-count={
            geometrySelectionPreviewRects.length
          }
          style={{
            width: `${pageCssWidth}px`,
            height: `${pageCssHeight}px`,
          }}
        >
          {geometrySelectionPreviewRects.map((rect, index) => (
            <div
              key={`${pageNumber}-geometry-selection-${index}-${rect.x}-${rect.y}`}
              data-knexread-page-geometry-selection-rect="true"
              style={{
                position: "absolute",
                left: `${rect.x}px`,
                top: `${rect.y}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                background: "rgba(59, 130, 246, 0.28)",
                borderRadius: "2px",
              }}
            />
          ))}
        </div>
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
