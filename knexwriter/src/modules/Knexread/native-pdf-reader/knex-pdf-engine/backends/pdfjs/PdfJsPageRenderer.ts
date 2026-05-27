import type { PdfBackendPageHandle } from "../PdfRenderBackend";
import type {
  KnexPdfCanvasRenderResult,
  KnexPdfRenderQualityInput,
} from "../../core/engineTypes";
import type { KnexPdfRenderPhase } from "../../rendering/RenderQualityController";
import {
  renderPdfJsPageToHiDpiCanvas,
  type PdfJsPageLike,
} from "../../rendering/HiDpiCanvasRenderer";

function safeNumber(
  value: number | null | undefined,
  fallback = 0,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function normalizeRenderScale(scale: number): number {
  /**
   * Escala lógica da página.
   *
   * 1.0 = 100%
   * 1.5 = 150%
   * 4.0 = 400%
   *
   * Importante:
   * - Não aplicar devicePixelRatio aqui.
   * - Não multiplicar por quality aqui.
   * - Não usar outputScale aqui.
   *
   * A nitidez real deve ser resolvida dentro do HiDpiCanvasRenderer,
   * usando outputScale.
   */
  return Math.max(0.01, safeNumber(scale, 1));
}

function assertPdfJsPageLike(page: unknown): asserts page is PdfJsPageLike {
  const maybePage = page as Partial<PdfJsPageLike> | null | undefined;

  if (
    !maybePage ||
    typeof maybePage.getViewport !== "function" ||
    typeof maybePage.render !== "function"
  ) {
    throw new Error("Invalid PDF.js page object received by PdfJsPageRenderer.");
  }
}

/**
 * PdfJsPageRenderer
 * ------------------------------------------------------------
 * Este arquivo é apenas a ponte entre o backend PDF.js e o HiDPI renderer.
 *
 * Ele NÃO deve:
 * - calcular devicePixelRatio;
 * - multiplicar escala por qualidade;
 * - aplicar CSS transform;
 * - reduzir bitmap;
 * - copiar canvas;
 * - decidir outputScale.
 *
 * Ele deve apenas:
 * - validar a página;
 * - normalizar escala lógica;
 * - repassar quality intacto para o HiDpiCanvasRenderer.
 */
export class PdfJsPageRenderer {
  render(input: {
    page: PdfBackendPageHandle;
    canvas: HTMLCanvasElement;
    scale: number;
    quality?: KnexPdfRenderQualityInput;
    renderPhase?: KnexPdfRenderPhase;
    signal?: AbortSignal;
  }): Promise<KnexPdfCanvasRenderResult> {
    assertPdfJsPageLike(input.page.backendPage);

    return renderPdfJsPageToHiDpiCanvas({
      pageNumber: input.page.pageNumber,
      page: input.page.backendPage,
      canvas: input.canvas,
      scale: normalizeRenderScale(input.scale),
      quality: input.quality,
      renderPhase: input.renderPhase,
      signal: input.signal,
    });
  }
}
