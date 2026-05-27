import type { KnexPdfZoomCenterAnchor } from "../core/engineTypes";

export type KnexPdfViewMode = "single" | "sideBySide";

export type KnexPdfZoomAnchorKind =
  | "content-center"
  | "viewport-center"
  | "pointer";

export type CreateZoomCenterAnchorInput = {
  viewportWidth: number;
  viewportHeight: number;

  activePageNumber: number;
  mode: KnexPdfViewMode;

  sourcePageLeft: number;
  sourcePageTop: number;
  sourcePageWidth: number;
  sourcePageHeight: number;

  /**
   * Scroll atual do container no momento em que a âncora é capturada.
   *
   * Para zoom fluido, estes valores precisam representar o estado ANTES
   * da mudança de zoom.
   */
  currentScrollLeft?: number;
  currentScrollTop?: number;

  /**
   * Ponto do viewport usado como âncora.
   *
   * Para Ctrl + wheel:
   * - anchorClientX pode ser event.clientX relativo ao container;
   * - anchorClientY pode ser event.clientY relativo ao container.
   *
   * Para zoom central:
   * - deixe vazio e o centro do viewport será usado.
   */
  anchorClientX?: number;
  anchorClientY?: number;

  /**
   * Estratégia da âncora.
   *
   * content-center:
   *   comportamento antigo. Centraliza a página ou o par de páginas.
   *
   * viewport-center:
   *   preserva o ponto atualmente visível no centro do viewport.
   *
   * pointer:
   *   preserva o ponto sob o cursor/gesto.
   */
  anchorKind?: KnexPdfZoomAnchorKind;

  /**
   * Atalho de compatibilidade.
   *
   * Quando true e anchorKind não foi informado, usa "viewport-center".
   */
  preserveViewportPoint?: boolean;

  /**
   * Usado apenas no modo sideBySide.
   * Deve representar o início horizontal do conjunto:
   * página original + gap + folha traduzida.
   */
  pagePairLeft?: number;

  /**
   * Usado apenas no modo sideBySide.
   * Deve representar a largura total do conjunto:
   * sourcePageWidth + gap + translationPageWidth.
   */
  pagePairWidth?: number;
};

export type ComputeScrollForZoomCenterAnchorInput = {
  anchor: KnexPdfZoomCenterAnchor;

  viewportWidth: number;
  viewportHeight: number;

  maxScrollLeft: number;
  maxScrollTop: number;

  /**
   * Geometria da página DEPOIS do zoom.
   *
   * Quando estes dados são enviados, o controlador reconstrói o ponto ancorado
   * pela proporção interna da página/par de páginas. Isso evita o salto:
   * a página passa pelos tamanhos intermediários preservando o mesmo ponto
   * visual no viewport.
   */
  sourcePageLeft?: number;
  sourcePageTop?: number;
  sourcePageWidth?: number;
  sourcePageHeight?: number;

  pagePairLeft?: number;
  pagePairWidth?: number;

  /**
   * Quando true, mantém o scrollTop atual e só recalcula o eixo horizontal.
   * Útil em alguns ajustes de overflow horizontal.
   */
  keepCurrentScrollTop?: boolean;

  currentScrollTop?: number;
};

export type ScrollPoint = {
  scrollLeft: number;
  scrollTop: number;
};

type ContentBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

type RuntimeZoomCenterAnchor = KnexPdfZoomCenterAnchor & {
  anchorKind?: KnexPdfZoomAnchorKind;

  /**
   * Ponto do viewport que deve permanecer preso ao conteúdo.
   * Para zoom central, normalmente é viewportWidth / 2 e viewportHeight / 2.
   * Para wheel/pinch, pode ser a posição do cursor ou do gesto.
   */
  anchorViewportX?: number;
  anchorViewportY?: number;

  /**
   * Ponto absoluto do conteúdo no momento da captura da âncora.
   */
  contentAnchorX?: number;
  contentAnchorY?: number;

  /**
   * Proporção interna do ponto ancorado dentro da página ou do par de páginas.
   * É isso que permite reconstruir a posição correta após cada microvariação
   * de zoom.
   */
  contentAnchorRatioX?: number;
  contentAnchorRatioY?: number;

  sourcePageLeft?: number;
  sourcePageTop?: number;
  sourcePageWidth?: number;
  sourcePageHeight?: number;

  pagePairLeft?: number;
  pagePairWidth?: number;
};

const SUBPIXEL_ROUNDING_FACTOR = 1000;

/**
 * Protege o motor contra NaN, Infinity, null e undefined.
 */
export function safeNumber(
  value: number | null | undefined,
  fallback = 0,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function roundToSubpixel(value: number): number {
  return Math.round(value * SUBPIXEL_ROUNDING_FACTOR) / SUBPIXEL_ROUNDING_FACTOR;
}

export function clamp(value: number, min: number, max: number): number {
  const safeMin = safeNumber(min, 0);
  const safeMax = Math.max(safeMin, safeNumber(max, safeMin));
  const safeValue = safeNumber(value, safeMin);

  return roundToSubpixel(Math.max(safeMin, Math.min(safeMax, safeValue)));
}

function clampRatio(value: number): number {
  return clamp(value, 0, 1);
}

function resolveAnchorKind(
  input: CreateZoomCenterAnchorInput,
): KnexPdfZoomAnchorKind {
  if (input.anchorKind) {
    return input.anchorKind;
  }

  if (input.preserveViewportPoint) {
    return "viewport-center";
  }

  return "content-center";
}

function hasUsablePagePairGeometry(input: {
  mode: KnexPdfViewMode;
  pagePairLeft?: number;
  pagePairWidth?: number;
}): boolean {
  return (
    input.mode === "sideBySide" &&
    isFiniteNumber(input.pagePairLeft) &&
    isFiniteNumber(input.pagePairWidth) &&
    safeNumber(input.pagePairWidth, 0) > 0
  );
}

function getSourcePageBounds(input: {
  sourcePageLeft: number;
  sourcePageTop: number;
  sourcePageWidth: number;
  sourcePageHeight: number;
}): ContentBounds {
  const left = safeNumber(input.sourcePageLeft, 0);
  const top = safeNumber(input.sourcePageTop, 0);
  const width = Math.max(1, safeNumber(input.sourcePageWidth, 1));
  const height = Math.max(1, safeNumber(input.sourcePageHeight, 1));

  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

function getAnchorContentBounds(input: {
  mode: KnexPdfViewMode;
  sourcePageLeft: number;
  sourcePageTop: number;
  sourcePageWidth: number;
  sourcePageHeight: number;
  pagePairLeft?: number;
  pagePairWidth?: number;
}): ContentBounds {
  const sourceBounds = getSourcePageBounds({
    sourcePageLeft: input.sourcePageLeft,
    sourcePageTop: input.sourcePageTop,
    sourcePageWidth: input.sourcePageWidth,
    sourcePageHeight: input.sourcePageHeight,
  });

  if (
    hasUsablePagePairGeometry({
      mode: input.mode,
      pagePairLeft: input.pagePairLeft,
      pagePairWidth: input.pagePairWidth,
    })
  ) {
    const left = safeNumber(input.pagePairLeft, sourceBounds.left);
    const width = Math.max(1, safeNumber(input.pagePairWidth, sourceBounds.width));

    return {
      left,
      top: sourceBounds.top,
      width,
      height: sourceBounds.height,
      right: left + width,
      bottom: sourceBounds.bottom,
    };
  }

  return sourceBounds;
}

function getNextAnchorContentBounds(input: {
  anchor: RuntimeZoomCenterAnchor;
  sourcePageLeft?: number;
  sourcePageTop?: number;
  sourcePageWidth?: number;
  sourcePageHeight?: number;
  pagePairLeft?: number;
  pagePairWidth?: number;
}): ContentBounds | null {
  const sourcePageLeft = input.sourcePageLeft ?? input.anchor.sourcePageLeft;
  const sourcePageTop = input.sourcePageTop ?? input.anchor.sourcePageTop;
  const sourcePageWidth = input.sourcePageWidth ?? input.anchor.sourcePageWidth;
  const sourcePageHeight =
    input.sourcePageHeight ?? input.anchor.sourcePageHeight;

  if (
    !isFiniteNumber(sourcePageLeft) ||
    !isFiniteNumber(sourcePageTop) ||
    !isFiniteNumber(sourcePageWidth) ||
    !isFiniteNumber(sourcePageHeight) ||
    sourcePageWidth <= 0 ||
    sourcePageHeight <= 0
  ) {
    return null;
  }

  return getAnchorContentBounds({
    mode: input.anchor.mode,
    sourcePageLeft,
    sourcePageTop,
    sourcePageWidth,
    sourcePageHeight,
    pagePairLeft: input.pagePairLeft ?? input.anchor.pagePairLeft,
    pagePairWidth: input.pagePairWidth ?? input.anchor.pagePairWidth,
  });
}

function computeRatioWithinBounds(input: {
  value: number;
  start: number;
  size: number;
}): number {
  return clampRatio(
    (safeNumber(input.value, input.start) - input.start) /
      Math.max(1, input.size),
  );
}

function computeContentPointFromRatios(input: {
  bounds: ContentBounds;
  ratioX?: number;
  ratioY?: number;
  fallbackX: number;
  fallbackY: number;
}) {
  if (!isFiniteNumber(input.ratioX) || !isFiniteNumber(input.ratioY)) {
    return {
      x: safeNumber(input.fallbackX, input.bounds.left + input.bounds.width / 2),
      y: safeNumber(input.fallbackY, input.bounds.top + input.bounds.height / 2),
    };
  }

  return {
    x: input.bounds.left + clampRatio(input.ratioX) * input.bounds.width,
    y: input.bounds.top + clampRatio(input.ratioY) * input.bounds.height,
  };
}

function computeAnchoredContentPoint(input: {
  anchorKind: KnexPdfZoomAnchorKind;
  viewportWidth: number;
  viewportHeight: number;
  currentScrollLeft?: number;
  currentScrollTop?: number;
  anchorClientX?: number;
  anchorClientY?: number;
  fallbackContentCenterX: number;
  fallbackContentCenterY: number;
  bounds: ContentBounds;
}) {
  if (input.anchorKind === "content-center") {
    return {
      anchorViewportX: input.viewportWidth / 2,
      anchorViewportY: input.viewportHeight / 2,
      contentAnchorX: input.fallbackContentCenterX,
      contentAnchorY: input.fallbackContentCenterY,
    };
  }

  const anchorViewportX =
    input.anchorKind === "pointer" && isFiniteNumber(input.anchorClientX)
      ? clamp(input.anchorClientX, 0, input.viewportWidth)
      : input.viewportWidth / 2;

  const anchorViewportY =
    input.anchorKind === "pointer" && isFiniteNumber(input.anchorClientY)
      ? clamp(input.anchorClientY, 0, input.viewportHeight)
      : input.viewportHeight / 2;

  const rawContentAnchorX =
    safeNumber(input.currentScrollLeft, 0) + anchorViewportX;
  const rawContentAnchorY =
    safeNumber(input.currentScrollTop, 0) + anchorViewportY;

  return {
    anchorViewportX,
    anchorViewportY,
    contentAnchorX: clamp(rawContentAnchorX, input.bounds.left, input.bounds.right),
    contentAnchorY: clamp(rawContentAnchorY, input.bounds.top, input.bounds.bottom),
  };
}

export function computeSourcePageCenter(input: {
  sourcePageLeft: number;
  sourcePageTop: number;
  sourcePageWidth: number;
  sourcePageHeight: number;
}) {
  const sourcePageLeft = safeNumber(input.sourcePageLeft, 0);
  const sourcePageTop = safeNumber(input.sourcePageTop, 0);
  const sourcePageWidth = Math.max(1, safeNumber(input.sourcePageWidth, 1));
  const sourcePageHeight = Math.max(1, safeNumber(input.sourcePageHeight, 1));

  return {
    sourcePageCenterX: sourcePageLeft + sourcePageWidth / 2,
    sourcePageCenterY: sourcePageTop + sourcePageHeight / 2,
  };
}

export function computePagePairCenter(input: {
  pagePairLeft?: number;
  pagePairWidth?: number;
}): number | undefined {
  if (
    !isFiniteNumber(input.pagePairLeft) ||
    !isFiniteNumber(input.pagePairWidth) ||
    safeNumber(input.pagePairWidth, 0) <= 0
  ) {
    return undefined;
  }

  return safeNumber(input.pagePairLeft, 0) + safeNumber(input.pagePairWidth, 0) / 2;
}

/**
 * Cria a âncora central lógica do viewer.
 *
 * Importante:
 * - Esta âncora NÃO usa o zero da régua.
 * - O zero da régua deve continuar sendo origem métrica da largura do PDF.
 * - Esta âncora é uma geometria interna para estabilizar zoom, scroll e side by side.
 *
 * Modos:
 *
 * content-center:
 *   comportamento antigo. Centraliza a página original ou o PagePair.
 *
 * viewport-center:
 *   preserva o ponto que estava no centro visível do viewport antes do zoom.
 *
 * pointer:
 *   preserva o ponto sob o cursor/gesto antes do zoom.
 */
export function createZoomCenterAnchor(
  input: CreateZoomCenterAnchorInput,
): KnexPdfZoomCenterAnchor {
  const viewportWidth = Math.max(1, safeNumber(input.viewportWidth, 1));
  const viewportHeight = Math.max(1, safeNumber(input.viewportHeight, 1));

  const { sourcePageCenterX, sourcePageCenterY } = computeSourcePageCenter({
    sourcePageLeft: input.sourcePageLeft,
    sourcePageTop: input.sourcePageTop,
    sourcePageWidth: input.sourcePageWidth,
    sourcePageHeight: input.sourcePageHeight,
  });

  const pagePairCenterX = hasUsablePagePairGeometry(input)
    ? computePagePairCenter({
        pagePairLeft: input.pagePairLeft,
        pagePairWidth: input.pagePairWidth,
      })
    : undefined;

  const fallbackContentCenterX =
    input.mode === "sideBySide" && typeof pagePairCenterX === "number"
      ? pagePairCenterX
      : sourcePageCenterX;

  const fallbackContentCenterY = sourcePageCenterY;

  const anchorKind = resolveAnchorKind(input);

  const bounds = getAnchorContentBounds({
    mode: input.mode,
    sourcePageLeft: input.sourcePageLeft,
    sourcePageTop: input.sourcePageTop,
    sourcePageWidth: input.sourcePageWidth,
    sourcePageHeight: input.sourcePageHeight,
    pagePairLeft: input.pagePairLeft,
    pagePairWidth: input.pagePairWidth,
  });

  const anchoredPoint = computeAnchoredContentPoint({
    anchorKind,
    viewportWidth,
    viewportHeight,
    currentScrollLeft: input.currentScrollLeft,
    currentScrollTop: input.currentScrollTop,
    anchorClientX: input.anchorClientX,
    anchorClientY: input.anchorClientY,
    fallbackContentCenterX,
    fallbackContentCenterY,
    bounds,
  });

  const contentAnchorRatioX = computeRatioWithinBounds({
    value: anchoredPoint.contentAnchorX,
    start: bounds.left,
    size: bounds.width,
  });

  const contentAnchorRatioY = computeRatioWithinBounds({
    value: anchoredPoint.contentAnchorY,
    start: bounds.top,
    size: bounds.height,
  });

  const anchor: RuntimeZoomCenterAnchor = {
    viewportCenterX: viewportWidth / 2,
    viewportCenterY: viewportHeight / 2,

    contentCenterX: anchoredPoint.contentAnchorX,
    contentCenterY: anchoredPoint.contentAnchorY,

    activePageNumber: Math.max(
      1,
      Math.floor(safeNumber(input.activePageNumber, 1)),
    ),
    mode: input.mode,

    sourcePageCenterX,
    pagePairCenterX,

    anchorKind,
    anchorViewportX: anchoredPoint.anchorViewportX,
    anchorViewportY: anchoredPoint.anchorViewportY,

    contentAnchorX: anchoredPoint.contentAnchorX,
    contentAnchorY: anchoredPoint.contentAnchorY,

    contentAnchorRatioX,
    contentAnchorRatioY,

    sourcePageLeft: safeNumber(input.sourcePageLeft, 0),
    sourcePageTop: safeNumber(input.sourcePageTop, 0),
    sourcePageWidth: Math.max(1, safeNumber(input.sourcePageWidth, 1)),
    sourcePageHeight: Math.max(1, safeNumber(input.sourcePageHeight, 1)),

    pagePairLeft: input.pagePairLeft,
    pagePairWidth: input.pagePairWidth,
  };

  return anchor;
}

function resolveContentPointForScroll(
  input: ComputeScrollForZoomCenterAnchorInput,
): {
  contentX: number;
  contentY: number;
  anchorViewportX: number;
  anchorViewportY: number;
} {
  const runtimeAnchor = input.anchor as RuntimeZoomCenterAnchor;

  const viewportWidth = Math.max(1, safeNumber(input.viewportWidth, 1));
  const viewportHeight = Math.max(1, safeNumber(input.viewportHeight, 1));

  const anchorViewportX = isFiniteNumber(runtimeAnchor.anchorViewportX)
    ? clamp(runtimeAnchor.anchorViewportX, 0, viewportWidth)
    : viewportWidth / 2;

  const anchorViewportY = isFiniteNumber(runtimeAnchor.anchorViewportY)
    ? clamp(runtimeAnchor.anchorViewportY, 0, viewportHeight)
    : viewportHeight / 2;

  const nextBounds = getNextAnchorContentBounds({
    anchor: runtimeAnchor,
    sourcePageLeft: input.sourcePageLeft,
    sourcePageTop: input.sourcePageTop,
    sourcePageWidth: input.sourcePageWidth,
    sourcePageHeight: input.sourcePageHeight,
    pagePairLeft: input.pagePairLeft,
    pagePairWidth: input.pagePairWidth,
  });

  if (nextBounds) {
    const point = computeContentPointFromRatios({
      bounds: nextBounds,
      ratioX: runtimeAnchor.contentAnchorRatioX,
      ratioY: runtimeAnchor.contentAnchorRatioY,
      fallbackX: runtimeAnchor.contentAnchorX ?? input.anchor.contentCenterX,
      fallbackY: runtimeAnchor.contentAnchorY ?? input.anchor.contentCenterY,
    });

    return {
      contentX: point.x,
      contentY: point.y,
      anchorViewportX,
      anchorViewportY,
    };
  }

  return {
    contentX: safeNumber(input.anchor.contentCenterX, viewportWidth / 2),
    contentY: safeNumber(input.anchor.contentCenterY, viewportHeight / 2),
    anchorViewportX,
    anchorViewportY,
  };
}

/**
 * Recalcula o scroll para manter o ponto lógico da âncora preso ao viewport.
 *
 * Para zoom fluido, o chamador deve passar a geometria da página após o zoom:
 * sourcePageLeft/sourcePageTop/sourcePageWidth/sourcePageHeight.
 *
 * Assim o controlador não centraliza de forma saltada. Ele reconstrói o mesmo
 * ponto interno da página em cada microvariação do zoom.
 */
export function computeScrollForZoomCenterAnchor(
  input: ComputeScrollForZoomCenterAnchorInput,
): ScrollPoint {
  const maxScrollLeft = Math.max(0, safeNumber(input.maxScrollLeft, 0));
  const maxScrollTop = Math.max(0, safeNumber(input.maxScrollTop, 0));

  const resolved = resolveContentPointForScroll(input);

  const desiredScrollLeft = resolved.contentX - resolved.anchorViewportX;

  const desiredScrollTop = input.keepCurrentScrollTop
    ? safeNumber(input.currentScrollTop, 0)
    : resolved.contentY - resolved.anchorViewportY;

  return {
    scrollLeft: clamp(desiredScrollLeft, 0, maxScrollLeft),
    scrollTop: clamp(desiredScrollTop, 0, maxScrollTop),
  };
}

/**
 * Calcula apenas o scrollLeft.
 * Útil para HorizontalOverflowController e RulerScrollSyncController.
 */
export function computeHorizontalScrollForZoomCenterAnchor(input: {
  anchor: KnexPdfZoomCenterAnchor;
  viewportWidth: number;
  maxScrollLeft: number;

  sourcePageLeft?: number;
  sourcePageWidth?: number;
  sourcePageTop?: number;
  sourcePageHeight?: number;

  pagePairLeft?: number;
  pagePairWidth?: number;
}): number {
  const viewportWidth = Math.max(1, safeNumber(input.viewportWidth, 1));
  const maxScrollLeft = Math.max(0, safeNumber(input.maxScrollLeft, 0));

  const resolved = resolveContentPointForScroll({
    anchor: input.anchor,
    viewportWidth,
    viewportHeight: 1,
    maxScrollLeft,
    maxScrollTop: 0,
    sourcePageLeft: input.sourcePageLeft,
    sourcePageTop: input.sourcePageTop,
    sourcePageWidth: input.sourcePageWidth,
    sourcePageHeight: input.sourcePageHeight,
    pagePairLeft: input.pagePairLeft,
    pagePairWidth: input.pagePairWidth,
  });

  return clamp(resolved.contentX - resolved.anchorViewportX, 0, maxScrollLeft);
}

/**
 * Verifica se a âncora está numericamente válida.
 * Ajuda o debug a identificar layout quebrado antes de aplicar scroll.
 */
export function validateZoomCenterAnchor(anchor: KnexPdfZoomCenterAnchor): {
  valid: boolean;
  problems: string[];
} {
  const problems: string[] = [];
  const runtimeAnchor = anchor as RuntimeZoomCenterAnchor;

  const fields: Array<keyof KnexPdfZoomCenterAnchor> = [
    "viewportCenterX",
    "viewportCenterY",
    "contentCenterX",
    "contentCenterY",
    "sourcePageCenterX",
  ];

  for (const field of fields) {
    if (!Number.isFinite(anchor[field])) {
      problems.push(`${String(field)} is not finite`);
    }
  }

  if (anchor.mode === "sideBySide" && anchor.pagePairCenterX !== undefined) {
    if (!Number.isFinite(anchor.pagePairCenterX)) {
      problems.push("pagePairCenterX is not finite");
    }
  }

  if (anchor.activePageNumber < 1 || !Number.isFinite(anchor.activePageNumber)) {
    problems.push("activePageNumber is invalid");
  }

  if (
    runtimeAnchor.anchorKind &&
    runtimeAnchor.anchorKind !== "content-center" &&
    runtimeAnchor.anchorKind !== "viewport-center" &&
    runtimeAnchor.anchorKind !== "pointer"
  ) {
    problems.push("anchorKind is invalid");
  }

  if (
    runtimeAnchor.contentAnchorRatioX !== undefined &&
    !Number.isFinite(runtimeAnchor.contentAnchorRatioX)
  ) {
    problems.push("contentAnchorRatioX is not finite");
  }

  if (
    runtimeAnchor.contentAnchorRatioY !== undefined &&
    !Number.isFinite(runtimeAnchor.contentAnchorRatioY)
  ) {
    problems.push("contentAnchorRatioY is not finite");
  }

  return {
    valid: problems.length === 0,
    problems,
  };
}

/**
 * Função auxiliar para debug.
 */
export function describeZoomCenterAnchor(anchor: KnexPdfZoomCenterAnchor) {
  const runtimeAnchor = anchor as RuntimeZoomCenterAnchor;

  return {
    mode: anchor.mode,
    activePageNumber: anchor.activePageNumber,

    viewportCenterX: anchor.viewportCenterX,
    viewportCenterY: anchor.viewportCenterY,

    contentCenterX: anchor.contentCenterX,
    contentCenterY: anchor.contentCenterY,

    sourcePageCenterX: anchor.sourcePageCenterX,
    pagePairCenterX: anchor.pagePairCenterX,

    anchorKind: runtimeAnchor.anchorKind ?? "content-center",
    anchorViewportX: runtimeAnchor.anchorViewportX,
    anchorViewportY: runtimeAnchor.anchorViewportY,

    contentAnchorX: runtimeAnchor.contentAnchorX,
    contentAnchorY: runtimeAnchor.contentAnchorY,

    contentAnchorRatioX: runtimeAnchor.contentAnchorRatioX,
    contentAnchorRatioY: runtimeAnchor.contentAnchorRatioY,

    sourcePageLeft: runtimeAnchor.sourcePageLeft,
    sourcePageTop: runtimeAnchor.sourcePageTop,
    sourcePageWidth: runtimeAnchor.sourcePageWidth,
    sourcePageHeight: runtimeAnchor.sourcePageHeight,

    pagePairLeft: runtimeAnchor.pagePairLeft,
    pagePairWidth: runtimeAnchor.pagePairWidth,

    usesPagePairCenter:
      anchor.mode === "sideBySide" &&
      typeof anchor.pagePairCenterX === "number" &&
      anchor.contentCenterX === anchor.pagePairCenterX,
  };
}