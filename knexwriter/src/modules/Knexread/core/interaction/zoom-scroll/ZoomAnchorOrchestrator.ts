import type {
  ZoomAnchorApplyInput,
  ZoomAnchorApplyResult,
  ZoomAnchorSnapshot,
  ZoomScrollViewportMetrics,
  ZoomScrollWheelLikeEvent,
} from "./ZoomScrollTypes";
import { ZOOM_SCROLL_ASSIGNMENT_EPSILON } from "./ZoomScrollConstants";

/**
 * ZoomAnchorOrchestrator.ts
 * -----------------------------------------------------------------------------
 * Responsabilidade única:
 * manter o ponto visual preso durante o zoom.
 *
 * Este arquivo NÃO decide velocidade.
 * Este arquivo NÃO agenda render.
 * Este arquivo NÃO centraliza overflow horizontal.
 *
 * Ele faz apenas:
 * 1. capturar a âncora antes do zoom;
 * 2. calcular scrollLeft/scrollTop depois do zoom;
 * 3. opcionalmente aplicar esse scroll no viewport.
 *
 * A sensação de "mola" vem de aplicar a correção imediatamente, com
 * springStrength = 1. Não há curva temporal aqui.
 */

function safeNumber(value: number | null | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, safeNumber(value, min)));
}

function getNowMs(): number {
  return typeof performance !== "undefined" &&
    typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

export function readViewportMetrics(
  viewportEl: HTMLElement,
): ZoomScrollViewportMetrics {
  const viewportWidth = Math.max(1, viewportEl.clientWidth);
  const viewportHeight = Math.max(1, viewportEl.clientHeight);
  const scrollWidth = Math.max(viewportWidth, viewportEl.scrollWidth);
  const scrollHeight = Math.max(viewportHeight, viewportEl.scrollHeight);

  return {
    viewportWidth,
    viewportHeight,
    scrollLeft: safeNumber(viewportEl.scrollLeft, 0),
    scrollTop: safeNumber(viewportEl.scrollTop, 0),
    scrollWidth,
    scrollHeight,
    maxScrollLeft: Math.max(0, scrollWidth - viewportWidth),
    maxScrollTop: Math.max(0, scrollHeight - viewportHeight),
  };
}

export function captureZoomAnchor(input: {
  viewportEl: HTMLElement;
  event?: ZoomScrollWheelLikeEvent;
  currentZoomPercent: number;
}): ZoomAnchorSnapshot {
  const metrics = readViewportMetrics(input.viewportEl);
  const rect = input.viewportEl.getBoundingClientRect();

  const rawPointerX =
    typeof input.event?.clientX === "number"
      ? input.event.clientX - rect.left
      : metrics.viewportWidth / 2;

  const rawPointerY =
    typeof input.event?.clientY === "number"
      ? input.event.clientY - rect.top
      : metrics.viewportHeight / 2;

  const anchorViewportX = clamp(rawPointerX, 0, metrics.viewportWidth);
  const anchorViewportY = clamp(rawPointerY, 0, metrics.viewportHeight);

  return {
    viewportWidth: metrics.viewportWidth,
    viewportHeight: metrics.viewportHeight,
    scrollLeft: metrics.scrollLeft,
    scrollTop: metrics.scrollTop,
    maxScrollLeft: metrics.maxScrollLeft,
    maxScrollTop: metrics.maxScrollTop,
    anchorViewportX,
    anchorViewportY,
    contentX: metrics.scrollLeft + anchorViewportX,
    contentY: metrics.scrollTop + anchorViewportY,
    capturedZoomPercent: input.currentZoomPercent,
    capturedAtMs: getNowMs(),
  };
}

export function computeAnchorScrollForZoom(
  input: ZoomAnchorApplyInput,
): ZoomAnchorApplyResult {
  const previousZoomPercent = Math.max(1, safeNumber(input.previousZoomPercent, 100));
  const nextZoomPercent = Math.max(1, safeNumber(input.nextZoomPercent, previousZoomPercent));
  const zoomRatio = nextZoomPercent / previousZoomPercent;
  const springStrength = clamp(safeNumber(input.springStrength, 1), 0, 1);

  const directScrollLeft =
    input.anchor.contentX * zoomRatio - input.anchor.anchorViewportX;
  const directScrollTop =
    input.anchor.contentY * zoomRatio - input.anchor.anchorViewportY;

  /*
   * springStrength = 1:
   * correção direta, sem curva lenta.
   *
   * Valores menores podem ser usados em testes, mas para a sensação desejada
   * de resposta profissional, o padrão deve ser 1.
   */
  const blendedScrollLeft =
    input.anchor.scrollLeft +
    (directScrollLeft - input.anchor.scrollLeft) * springStrength;

  const blendedScrollTop =
    input.anchor.scrollTop +
    (directScrollTop - input.anchor.scrollTop) * springStrength;

  return {
    scrollLeft: clamp(blendedScrollLeft, 0, input.maxScrollLeft),
    scrollTop: clamp(blendedScrollTop, 0, input.maxScrollTop),
    audit: {
      source: "ZoomAnchorOrchestrator",
      zoomRatio,
      springStrength,
    },
  };
}

export function applyAnchorScrollNow(input: {
  viewportEl: HTMLElement;
  scrollLeft: number;
  scrollTop: number;
}) {
  const currentLeft = safeNumber(input.viewportEl.scrollLeft, 0);
  const currentTop = safeNumber(input.viewportEl.scrollTop, 0);

  const previousScrollBehavior = input.viewportEl.style.scrollBehavior;
  input.viewportEl.style.scrollBehavior = "auto";

  if (Math.abs(currentLeft - input.scrollLeft) > ZOOM_SCROLL_ASSIGNMENT_EPSILON) {
    input.viewportEl.scrollLeft = input.scrollLeft;
  }

  if (Math.abs(currentTop - input.scrollTop) > ZOOM_SCROLL_ASSIGNMENT_EPSILON) {
    input.viewportEl.scrollTop = input.scrollTop;
  }

  input.viewportEl.style.scrollBehavior = previousScrollBehavior;
}
