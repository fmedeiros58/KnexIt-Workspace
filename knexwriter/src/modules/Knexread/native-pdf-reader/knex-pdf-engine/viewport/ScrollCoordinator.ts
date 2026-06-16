/**
 * ScrollCoordinator.ts
 * ------------------------------------------------------------
 * Coordenador profissional de scroll/viewport para o KnexPDF Engine.
 *
 * Objetivo:
 * - Preservar âncora visual durante zoom, fit, resize e troca de modo.
 * - Impedir saltos laterais e perda do centro lógico.
 * - Separar 0 da régua do centro lógico de zoom.
 * - Sincronizar régua imediatamente após qualquer alteração de scroll.
 * - Proteger contra NaN, Infinity, layout antigo e overflow falso.
 *
 * Observação arquitetural:
 * Este arquivo NÃO deve controlar renderização do canvas.
 * Ele coordena geometria de viewport, scroll e âncoras.
 */

export type ScrollPoint = {
  scrollLeft: number;
  scrollTop: number;
};

export type ScrollBounds = {
  maxScrollLeft: number;
  maxScrollTop: number;
};

export type LayoutVersion = number;

export type ViewMode = "single" | "sideBySide";

export type ScrollReason =
  | "zoom"
  | "wheel-zoom"
  | "pinch-zoom"
  | "fit-width"
  | "fit-page"
  | "actual-size"
  | "view-mode-change"
  | "resize"
  | "overflow-change"
  | "manual"
  | "restore";

export type AnchorStrategy =
  | "viewport-center"
  | "pointer"
  | "logical-content-center";

export type ViewportSnapshot = {
  layoutVersion: LayoutVersion;

  viewportWidth: number;
  viewportHeight: number;

  scrollWidth: number;
  scrollHeight: number;

  contentWidth: number;
  contentHeight: number;

  scrollLeft: number;
  scrollTop: number;

  maxScrollLeft: number;
  maxScrollTop: number;
};

export type ViewportAnchor = {
  layoutVersion: LayoutVersion;

  anchorViewportX: number;
  anchorViewportY: number;

  /**
   * Coordenada absoluta no sistema do conteúdo no momento da captura.
   */
  contentX: number;
  contentY: number;

  /**
   * Coordenada proporcional ao tamanho do conteúdo.
   * Ajuda a restaurar a posição quando o conteúdo muda de escala.
   */
  normalizedX: number;
  normalizedY: number;

  /**
   * Dimensões efetivas do conteúdo no momento da captura.
   *
   * São usadas para reconstruir a posição após o zoom por razão de escala,
   * reduzindo saltos quando o conteúdo muda de tamanho a cada microvariação.
   */
  contentWidthAtCapture: number;
  contentHeightAtCapture: number;

  /**
   * Scroll no momento da captura.
   * Útil para debug e para diagnosticar perda de âncora.
   */
  scrollLeftAtCapture: number;
  scrollTopAtCapture: number;

  strategy: AnchorStrategy;
};

export type LogicalContentCenter = {
  /**
   * Centro lógico horizontal do conteúdo ativo.
   *
   * single:
   *   sourcePageLeft + sourcePageWidth / 2
   *
   * sideBySide:
   *   pagePairLeft + pagePairWidth / 2
   */
  contentCenterX: number;

  /**
   * Opcional. Use quando quiser também preservar centralidade vertical.
   */
  contentCenterY?: number;
};

export type ScrollTransaction = {
  layoutVersion: LayoutVersion;
  reason: ScrollReason;
  nextScrollLeft: number;
  nextScrollTop: number;
};

export type HorizontalOverflowDecision = {
  shouldHide: boolean;
  contentWidth: number;
  viewportWidth: number;
  tolerance: number;
};

export type ScrollCoordinatorHooks = {
  /**
   * Deve sincronizar a régua imediatamente após qualquer alteração de scroll.
   * Exemplo: rulerScrollSyncController.sync();
   */
  onAfterScroll?: () => void;

  /**
   * Útil para debug em desenvolvimento.
   */
  onDebug?: (eventName: string, payload: Record<string, unknown>) => void;
};

export type CreateViewportSnapshotInput = {
  viewportEl: HTMLElement;
  contentWidth: number;
  contentHeight: number;
  layoutVersion: LayoutVersion;
};

export type CaptureAnchorInput = {
  snapshot: ViewportSnapshot;
  anchorViewportX?: number;
  anchorViewportY?: number;
  strategy?: AnchorStrategy;
};

export type CaptureWheelAnchorInput = {
  event: WheelEvent;
  viewportEl: HTMLElement;
  snapshot: ViewportSnapshot;
};

export type RestoreScrollFromAnchorInput = {
  anchor: ViewportAnchor;
  nextSnapshot: ViewportSnapshot;
};

export type CenterScrollInput = {
  snapshot: ViewportSnapshot;
  logicalCenter: LogicalContentCenter;
  keepScrollTop?: boolean;
};

export type CommitScrollTransactionInput = {
  viewportEl: HTMLElement;
  transaction: ScrollTransaction;
  currentLayoutVersion: LayoutVersion;
  hooks?: ScrollCoordinatorHooks;

  /**
   * true:
   *   exige que transaction.layoutVersion seja exatamente igual ao layout atual.
   *
   * false:
   *   permite aplicar transações de zoom interativo levemente atrasadas.
   *
   * Durante wheel/pinch zoom, o layout muda muito rápido. Se descartarmos toda
   * transação por diferença mínima de versão, o scroll não acompanha cada
   * microvariação e o usuário perde a referência geográfica.
   */
  strictLayoutVersion?: boolean;

  /**
   * Quando true, permite aplicar transações interativas atrasadas em poucos
   * frames. Isso melhora a continuidade visual em zoom por wheel/pinch.
   */
  allowInteractiveStaleTransaction?: boolean;
};

const DEFAULT_PIXEL_TOLERANCE = 2;
const SUBPIXEL_ROUNDING_FACTOR = 1000;
const SCROLL_ASSIGNMENT_EPSILON = 0.01;
const MAX_INTERACTIVE_STALE_LAYOUT_DRIFT = 8;

/**
 * Evita NaN, Infinity, null e undefined entrando na geometria do viewer.
 *
 * IMPORTANTE:
 * A função aceita number | null | undefined porque várias entradas de âncora
 * são opcionais. Quando a âncora não vem informada, usamos fallback seguro,
 * geralmente o centro do viewport.
 */
export function safeNumber(
  value: number | null | undefined,
  fallback = 0,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

export function roundToSubpixel(value: number): number {
  return Math.round(value * SUBPIXEL_ROUNDING_FACTOR) / SUBPIXEL_ROUNDING_FACTOR;
}

export function clampValue(value: number, min: number, max: number): number {
  const safeMin = safeNumber(min, 0);
  const safeMax = Math.max(safeMin, safeNumber(max, safeMin));
  const safeValue = safeNumber(value, safeMin);

  return Math.max(safeMin, Math.min(safeMax, safeValue));
}

function isInteractiveZoomReason(reason: ScrollReason): boolean {
  return reason === "zoom" || reason === "wheel-zoom" || reason === "pinch-zoom";
}

function getEffectiveSnapshotContentWidth(snapshot: ViewportSnapshot): number {
  /**
   * Para preservar referência geográfica, usamos a maior dimensão efetiva.
   *
   * Em alguns momentos do React, contentWidth medido pelo layout e scrollWidth
   * do DOM podem não estar sincronizados no mesmo frame. Usar a maior dimensão
   * reduz perda de âncora em microvariações de zoom.
   */
  return Math.max(
    1,
    safeNumber(snapshot.contentWidth, 1),
    safeNumber(snapshot.scrollWidth, 1),
    safeNumber(snapshot.viewportWidth, 1),
  );
}

function getEffectiveSnapshotContentHeight(snapshot: ViewportSnapshot): number {
  return Math.max(
    1,
    safeNumber(snapshot.contentHeight, 1),
    safeNumber(snapshot.scrollHeight, 1),
    safeNumber(snapshot.viewportHeight, 1),
  );
}

export function getScrollBounds(input: {
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
}): ScrollBounds {
  const maxScrollLeft = Math.max(
    0,
    safeNumber(input.scrollWidth, 0) - safeNumber(input.clientWidth, 0),
  );

  const maxScrollTop = Math.max(
    0,
    safeNumber(input.scrollHeight, 0) - safeNumber(input.clientHeight, 0),
  );

  return {
    maxScrollLeft,
    maxScrollTop,
  };
}

/**
 * Mantém compatibilidade com a função antiga, mas agora com proteção numérica.
 */
export function clampScroll(input: {
  scrollLeft: number;
  scrollTop: number;
  maxScrollLeft: number;
  maxScrollTop: number;
}): ScrollPoint {
  return {
    scrollLeft: roundToSubpixel(
      clampValue(input.scrollLeft, 0, input.maxScrollLeft),
    ),
    scrollTop: roundToSubpixel(
      clampValue(input.scrollTop, 0, input.maxScrollTop),
    ),
  };
}

export function createViewportSnapshot(
  input: CreateViewportSnapshotInput,
): ViewportSnapshot {
  const viewportWidth = Math.max(
    1,
    safeNumber(input.viewportEl.clientWidth, 1),
  );
  const viewportHeight = Math.max(
    1,
    safeNumber(input.viewportEl.clientHeight, 1),
  );

  const scrollWidth = Math.max(
    1,
    safeNumber(input.viewportEl.scrollWidth, viewportWidth),
  );
  const scrollHeight = Math.max(
    1,
    safeNumber(input.viewportEl.scrollHeight, viewportHeight),
  );

  const contentWidth = Math.max(
    1,
    safeNumber(input.contentWidth, scrollWidth),
    scrollWidth,
    viewportWidth,
  );

  const contentHeight = Math.max(
    1,
    safeNumber(input.contentHeight, scrollHeight),
    scrollHeight,
    viewportHeight,
  );

  const bounds = getScrollBounds({
    scrollWidth,
    scrollHeight,
    clientWidth: viewportWidth,
    clientHeight: viewportHeight,
  });

  return {
    layoutVersion: input.layoutVersion,

    viewportWidth,
    viewportHeight,

    scrollWidth,
    scrollHeight,

    contentWidth,
    contentHeight,

    scrollLeft: safeNumber(input.viewportEl.scrollLeft, 0),
    scrollTop: safeNumber(input.viewportEl.scrollTop, 0),

    maxScrollLeft: bounds.maxScrollLeft,
    maxScrollTop: bounds.maxScrollTop,
  };
}

/**
 * Captura uma âncora visual dentro do viewport.
 *
 * Regra:
 * - Zoom por botão/campo/preset: normalmente usar centro do viewport.
 * - Ctrl + wheel: pode usar posição do ponteiro.
 * - Fit/sideBySide: pode usar centro lógico do conteúdo.
 */
export function captureViewportAnchor(
  input: CaptureAnchorInput,
): ViewportAnchor {
  const anchorViewportX = clampValue(
    safeNumber(input.anchorViewportX, input.snapshot.viewportWidth / 2),
    0,
    input.snapshot.viewportWidth,
  );

  const anchorViewportY = clampValue(
    safeNumber(input.anchorViewportY, input.snapshot.viewportHeight / 2),
    0,
    input.snapshot.viewportHeight,
  );

  const effectiveContentWidth = getEffectiveSnapshotContentWidth(input.snapshot);
  const effectiveContentHeight =
    getEffectiveSnapshotContentHeight(input.snapshot);

  const contentX = clampValue(
    input.snapshot.scrollLeft + anchorViewportX,
    0,
    effectiveContentWidth,
  );

  const contentY = clampValue(
    input.snapshot.scrollTop + anchorViewportY,
    0,
    effectiveContentHeight,
  );

  return {
    layoutVersion: input.snapshot.layoutVersion,

    anchorViewportX,
    anchorViewportY,

    contentX,
    contentY,

    normalizedX: clampValue(contentX / effectiveContentWidth, 0, 1),
    normalizedY: clampValue(contentY / effectiveContentHeight, 0, 1),

    contentWidthAtCapture: effectiveContentWidth,
    contentHeightAtCapture: effectiveContentHeight,

    scrollLeftAtCapture: input.snapshot.scrollLeft,
    scrollTopAtCapture: input.snapshot.scrollTop,

    strategy: input.strategy ?? "viewport-center",
  };
}

/**
 * Captura âncora para Ctrl + wheel.
 * Se o ponteiro estiver fora do viewport, usa centro do viewport.
 */
export function captureWheelAnchor(
  input: CaptureWheelAnchorInput,
): ViewportAnchor {
  const rect = input.viewportEl.getBoundingClientRect();

  const pointerX = input.event.clientX - rect.left;
  const pointerY = input.event.clientY - rect.top;

  const insideViewport =
    pointerX >= 0 &&
    pointerY >= 0 &&
    pointerX <= input.viewportEl.clientWidth &&
    pointerY <= input.viewportEl.clientHeight;

  return captureViewportAnchor({
    snapshot: input.snapshot,
    anchorViewportX: insideViewport
      ? pointerX
      : input.snapshot.viewportWidth / 2,
    anchorViewportY: insideViewport
      ? pointerY
      : input.snapshot.viewportHeight / 2,
    strategy: insideViewport ? "pointer" : "viewport-center",
  });
}

/**
 * Captura âncora usando o centro lógico do conteúdo ativo.
 * Isso NÃO usa o 0 da régua.
 */
export function captureLogicalCenterAnchor(input: {
  snapshot: ViewportSnapshot;
  logicalCenter: LogicalContentCenter;
}): ViewportAnchor {
  const anchorViewportX =
    input.logicalCenter.contentCenterX - input.snapshot.scrollLeft;

  const anchorViewportY =
    typeof input.logicalCenter.contentCenterY === "number"
      ? input.logicalCenter.contentCenterY - input.snapshot.scrollTop
      : input.snapshot.viewportHeight / 2;

  return captureViewportAnchor({
    snapshot: input.snapshot,
    anchorViewportX,
    anchorViewportY,
    strategy: "logical-content-center",
  });
}

function projectAnchorContentPoint(input: {
  anchor: ViewportAnchor;
  nextSnapshot: ViewportSnapshot;
}): {
  nextContentX: number;
  nextContentY: number;
} {
  const nextContentWidth = getEffectiveSnapshotContentWidth(input.nextSnapshot);
  const nextContentHeight =
    getEffectiveSnapshotContentHeight(input.nextSnapshot);

  const previousContentWidth = Math.max(
    1,
    safeNumber(input.anchor.contentWidthAtCapture, 1),
  );

  const previousContentHeight = Math.max(
    1,
    safeNumber(input.anchor.contentHeightAtCapture, 1),
  );

  const scaleX = nextContentWidth / previousContentWidth;
  const scaleY = nextContentHeight / previousContentHeight;

  /**
   * Projeção principal:
   * preserva o mesmo ponto geográfico do conteúdo após mudança de escala.
   *
   * Fallback:
   * se algum valor vier inválido, usa normalizedX/Y.
   */
  const projectedX = safeNumber(
    input.anchor.contentX * scaleX,
    input.anchor.normalizedX * nextContentWidth,
  );

  const projectedY = safeNumber(
    input.anchor.contentY * scaleY,
    input.anchor.normalizedY * nextContentHeight,
  );

  return {
    nextContentX: clampValue(projectedX, 0, nextContentWidth),
    nextContentY: clampValue(projectedY, 0, nextContentHeight),
  };
}

/**
 * Restaura o scroll de modo que a âncora capturada continue no mesmo ponto
 * visual do viewport após mudança de zoom/layout.
 */
export function restoreScrollFromAnchor(
  input: RestoreScrollFromAnchorInput,
): ScrollPoint {
  const projected = projectAnchorContentPoint({
    anchor: input.anchor,
    nextSnapshot: input.nextSnapshot,
  });

  const desiredScrollLeft =
    projected.nextContentX - input.anchor.anchorViewportX;

  const desiredScrollTop =
    projected.nextContentY - input.anchor.anchorViewportY;

  return clampScroll({
    scrollLeft: desiredScrollLeft,
    scrollTop: desiredScrollTop,
    maxScrollLeft: input.nextSnapshot.maxScrollLeft,
    maxScrollTop: input.nextSnapshot.maxScrollTop,
  });
}

/**
 * Centraliza horizontalmente o viewport no centro lógico do conteúdo ativo.
 * Isso é usado quando a barra horizontal aparece, quando muda para sideBySide
 * ou quando é necessário recentralizar sem usar o 0 da régua.
 */
export function centerScrollOnLogicalContent(
  input: CenterScrollInput,
): ScrollPoint {
  const desiredScrollLeft =
    safeNumber(input.logicalCenter.contentCenterX, 0) -
    input.snapshot.viewportWidth / 2;

  const desiredScrollTop =
    typeof input.logicalCenter.contentCenterY === "number"
      ? input.logicalCenter.contentCenterY - input.snapshot.viewportHeight / 2
      : input.snapshot.scrollTop;

  return clampScroll({
    scrollLeft: desiredScrollLeft,
    scrollTop: input.keepScrollTop ? input.snapshot.scrollTop : desiredScrollTop,
    maxScrollLeft: input.snapshot.maxScrollLeft,
    maxScrollTop: input.snapshot.maxScrollTop,
  });
}

/**
 * Decide se o overflow horizontal deve ser ocultado.
 * A tolerância evita barra aparecendo por 1 ou 2 px de erro fracionário.
 */
export function shouldHideHorizontalOverflow(input: {
  contentWidth: number;
  viewportWidth: number;
  tolerance?: number;
}): boolean {
  const tolerance = input.tolerance ?? DEFAULT_PIXEL_TOLERANCE;

  return (
    safeNumber(input.contentWidth, 0) <=
    safeNumber(input.viewportWidth, 0) + tolerance
  );
}

export function getHorizontalOverflowDecision(input: {
  contentWidth: number;
  viewportWidth: number;
  tolerance?: number;
}): HorizontalOverflowDecision {
  const tolerance = input.tolerance ?? DEFAULT_PIXEL_TOLERANCE;

  return {
    shouldHide: shouldHideHorizontalOverflow({
      contentWidth: input.contentWidth,
      viewportWidth: input.viewportWidth,
      tolerance,
    }),
    contentWidth: safeNumber(input.contentWidth, 0),
    viewportWidth: safeNumber(input.viewportWidth, 0),
    tolerance,
  };
}

export function createScrollTransaction(input: {
  snapshot: ViewportSnapshot;
  nextScrollLeft: number;
  nextScrollTop: number;
  reason: ScrollReason;
}): ScrollTransaction {
  const next = clampScroll({
    scrollLeft: input.nextScrollLeft,
    scrollTop: input.nextScrollTop,
    maxScrollLeft: input.snapshot.maxScrollLeft,
    maxScrollTop: input.snapshot.maxScrollTop,
  });

  return {
    layoutVersion: input.snapshot.layoutVersion,
    reason: input.reason,
    nextScrollLeft: next.scrollLeft,
    nextScrollTop: next.scrollTop,
  };
}

function canCommitTransactionForLayout(input: {
  transaction: ScrollTransaction;
  currentLayoutVersion: LayoutVersion;
  strictLayoutVersion?: boolean;
  allowInteractiveStaleTransaction?: boolean;
}): boolean {
  if (input.transaction.layoutVersion === input.currentLayoutVersion) {
    return true;
  }

  const strict = input.strictLayoutVersion ?? false;

  if (strict) {
    return false;
  }

  if (!isInteractiveZoomReason(input.transaction.reason)) {
    return false;
  }

  const allowInteractive =
    input.allowInteractiveStaleTransaction ?? true;

  if (!allowInteractive) {
    return false;
  }

  const versionDrift =
    input.currentLayoutVersion - input.transaction.layoutVersion;

  /**
   * Em zoom interativo, aceitar pequena defasagem ajuda o scroll a acompanhar
   * as microvariações. Se a defasagem for grande, descartamos para evitar que
   * uma transação muito antiga sobrescreva o estado atual.
   */
  return (
    versionDrift >= 0 &&
    versionDrift <= MAX_INTERACTIVE_STALE_LAYOUT_DRIFT
  );
}

function applyScrollInstantly(input: {
  viewportEl: HTMLElement;
  scrollLeft: number;
  scrollTop: number;
}): ScrollPoint & { changed: boolean } {
  const previousScrollBehavior = input.viewportEl.style.scrollBehavior;

  /**
   * Garante que o scroll aplicado pelo coordenador seja imediato.
   * Se houver scroll-behavior: smooth herdado por CSS, ele pode causar atraso
   * perceptível e dar sensação de zoom elástico.
   */
  input.viewportEl.style.scrollBehavior = "auto";

  const currentScrollLeft = safeNumber(input.viewportEl.scrollLeft, 0);
  const currentScrollTop = safeNumber(input.viewportEl.scrollTop, 0);

  const shouldAssignLeft =
    Math.abs(currentScrollLeft - input.scrollLeft) > SCROLL_ASSIGNMENT_EPSILON;

  const shouldAssignTop =
    Math.abs(currentScrollTop - input.scrollTop) > SCROLL_ASSIGNMENT_EPSILON;

  if (shouldAssignLeft) {
    input.viewportEl.scrollLeft = input.scrollLeft;
  }

  if (shouldAssignTop) {
    input.viewportEl.scrollTop = input.scrollTop;
  }

  input.viewportEl.style.scrollBehavior = previousScrollBehavior;

  return {
    scrollLeft: input.viewportEl.scrollLeft,
    scrollTop: input.viewportEl.scrollTop,
    changed: shouldAssignLeft || shouldAssignTop,
  };
}

/**
 * Aplica a transação.
 *
 * Durante zoom interativo, tolera pequena diferença de layoutVersion para não
 * perder a âncora geográfica entre microvariações.
 */
export function commitScrollTransaction(
  input: CommitScrollTransactionInput,
): ScrollPoint | null {
  const canCommit = canCommitTransactionForLayout({
    transaction: input.transaction,
    currentLayoutVersion: input.currentLayoutVersion,
    strictLayoutVersion: input.strictLayoutVersion,
    allowInteractiveStaleTransaction: input.allowInteractiveStaleTransaction,
  });

  if (!canCommit) {
    input.hooks?.onDebug?.("scroll.transaction.discarded", {
      transactionLayoutVersion: input.transaction.layoutVersion,
      currentLayoutVersion: input.currentLayoutVersion,
      reason: input.transaction.reason,
    });

    return null;
  }

  const result = applyScrollInstantly({
    viewportEl: input.viewportEl,
    scrollLeft: input.transaction.nextScrollLeft,
    scrollTop: input.transaction.nextScrollTop,
  });

  if (result.changed) {
    input.hooks?.onAfterScroll?.();
  }

  input.hooks?.onDebug?.("scroll.transaction.committed", {
    ...result,
    requestedScrollLeft: input.transaction.nextScrollLeft,
    requestedScrollTop: input.transaction.nextScrollTop,
    reason: input.transaction.reason,
    layoutVersion: input.transaction.layoutVersion,
    currentLayoutVersion: input.currentLayoutVersion,
  });

  return result;
}

export function preserveAnchorAfterZoom(input: {
  viewportEl: HTMLElement;
  anchor: ViewportAnchor;
  nextSnapshot: ViewportSnapshot;
  currentLayoutVersion: LayoutVersion;
  reason?: Extract<ScrollReason, "zoom" | "wheel-zoom" | "pinch-zoom">;
  hooks?: ScrollCoordinatorHooks;
}): ScrollPoint | null {
  const restored = restoreScrollFromAnchor({
    anchor: input.anchor,
    nextSnapshot: input.nextSnapshot,
  });

  const transaction = createScrollTransaction({
    snapshot: input.nextSnapshot,
    nextScrollLeft: restored.scrollLeft,
    nextScrollTop: restored.scrollTop,
    reason: input.reason ?? "zoom",
  });

  return commitScrollTransaction({
    viewportEl: input.viewportEl,
    transaction,
    currentLayoutVersion: input.currentLayoutVersion,
    hooks: input.hooks,
    strictLayoutVersion: false,
    allowInteractiveStaleTransaction: true,
  });
}

export function preserveAnchorAfterLayoutChange(input: {
  viewportEl: HTMLElement;
  anchor: ViewportAnchor;
  nextSnapshot: ViewportSnapshot;
  currentLayoutVersion: LayoutVersion;
  reason?: Extract<
    ScrollReason,
    "view-mode-change" | "resize" | "fit-width" | "fit-page" | "actual-size"
  >;
  hooks?: ScrollCoordinatorHooks;
}): ScrollPoint | null {
  const restored = restoreScrollFromAnchor({
    anchor: input.anchor,
    nextSnapshot: input.nextSnapshot,
  });

  const transaction = createScrollTransaction({
    snapshot: input.nextSnapshot,
    nextScrollLeft: restored.scrollLeft,
    nextScrollTop: restored.scrollTop,
    reason: input.reason ?? "view-mode-change",
  });

  return commitScrollTransaction({
    viewportEl: input.viewportEl,
    transaction,
    currentLayoutVersion: input.currentLayoutVersion,
    hooks: input.hooks,
    strictLayoutVersion: true,
  });
}

export function centerAfterOverflowChange(input: {
  viewportEl: HTMLElement;
  snapshot: ViewportSnapshot;
  logicalCenter: LogicalContentCenter;
  currentLayoutVersion: LayoutVersion;
  hooks?: ScrollCoordinatorHooks;
}): ScrollPoint | null {
  const centered = centerScrollOnLogicalContent({
    snapshot: input.snapshot,
    logicalCenter: input.logicalCenter,
    keepScrollTop: true,
  });

  const transaction = createScrollTransaction({
    snapshot: input.snapshot,
    nextScrollLeft: centered.scrollLeft,
    nextScrollTop: centered.scrollTop,
    reason: "overflow-change",
  });

  return commitScrollTransaction({
    viewportEl: input.viewportEl,
    transaction,
    currentLayoutVersion: input.currentLayoutVersion,
    hooks: input.hooks,
    strictLayoutVersion: true,
  });
}

export function setHorizontalOverflowMode(input: {
  viewportEl: HTMLElement;
  hide: boolean;
}): void {
  input.viewportEl.style.overflowX = input.hide ? "hidden" : "auto";

  /**
   * Não zerar scrollLeft aqui.
   *
   * Antes, ao esconder overflow horizontal, o coordenador podia forçar
   * scrollLeft = 0. Durante zoom, isso destrói a referência geográfica
   * horizontal e faz o documento "pular" para outro ponto.
   *
   * O navegador já limita visualmente o overflow quando overflowX = hidden.
   */
}

/**
 * Fluxo recomendado para overflow:
 * 1. mede conteúdo real;
 * 2. decide se overflow aparece;
 * 3. aplica overflow;
 * 4. se aparecer, centraliza pelo centro lógico;
 * 5. sincroniza régua no onAfterScroll.
 */
export function updateHorizontalOverflowAndCenter(input: {
  viewportEl: HTMLElement;
  snapshot: ViewportSnapshot;
  logicalCenter: LogicalContentCenter;
  currentLayoutVersion: LayoutVersion;
  tolerance?: number;
  hooks?: ScrollCoordinatorHooks;

  /**
   * Durante wheel/pinch zoom, não centralizar horizontalmente. A âncora visual
   * já foi preservada pelo ScrollCoordinator. Centralizar aqui cria salto e
   * sensação de zoom lento.
   */
  reason?: ScrollReason;
}): ScrollPoint | null {
  const decision = getHorizontalOverflowDecision({
    contentWidth: input.snapshot.contentWidth,
    viewportWidth: input.snapshot.viewportWidth,
    tolerance: input.tolerance,
  });

  setHorizontalOverflowMode({
    viewportEl: input.viewportEl,
    hide: decision.shouldHide,
  });

  input.hooks?.onDebug?.("overflow.horizontal.decision", decision);

  if (decision.shouldHide) {
    return {
      scrollLeft: input.viewportEl.scrollLeft,
      scrollTop: input.viewportEl.scrollTop,
    };
  }

  if (isInteractiveZoomReason(input.reason ?? "manual")) {
    /*
     * Em zoom por wheel/pinch, não recentralizar. Isso evita que o overflow
     * horizontal corrija o scrollLeft depois da âncora, causando salto lateral.
     */
    return {
      scrollLeft: input.viewportEl.scrollLeft,
      scrollTop: input.viewportEl.scrollTop,
    };
  }

  return centerAfterOverflowChange({
    viewportEl: input.viewportEl,
    snapshot: input.snapshot,
    logicalCenter: input.logicalCenter,
    currentLayoutVersion: input.currentLayoutVersion,
    hooks: input.hooks,
  });
}

/**
 * Classe opcional para quem preferir usar o coordenador de forma orientada a instância.
 * As funções puras acima continuam exportadas para facilitar testes.
 */
export class ScrollCoordinator {
  private viewportEl: HTMLElement;
  private hooks: ScrollCoordinatorHooks;

  constructor(input: {
    viewportEl: HTMLElement;
    hooks?: ScrollCoordinatorHooks;
  }) {
    this.viewportEl = input.viewportEl;
    this.hooks = input.hooks ?? {};
  }

  createSnapshot(input: {
    contentWidth: number;
    contentHeight: number;
    layoutVersion: LayoutVersion;
  }): ViewportSnapshot {
    return createViewportSnapshot({
      viewportEl: this.viewportEl,
      contentWidth: input.contentWidth,
      contentHeight: input.contentHeight,
      layoutVersion: input.layoutVersion,
    });
  }

  captureCenterAnchor(snapshot: ViewportSnapshot): ViewportAnchor {
    return captureViewportAnchor({
      snapshot,
      strategy: "viewport-center",
    });
  }

  captureWheelAnchor(
    event: WheelEvent,
    snapshot: ViewportSnapshot,
  ): ViewportAnchor {
    return captureWheelAnchor({
      event,
      viewportEl: this.viewportEl,
      snapshot,
    });
  }

  captureLogicalCenterAnchor(input: {
    snapshot: ViewportSnapshot;
    logicalCenter: LogicalContentCenter;
  }): ViewportAnchor {
    return captureLogicalCenterAnchor(input);
  }

  preserveAfterZoom(input: {
    anchor: ViewportAnchor;
    nextSnapshot: ViewportSnapshot;
    currentLayoutVersion: LayoutVersion;
    reason?: Extract<ScrollReason, "zoom" | "wheel-zoom" | "pinch-zoom">;
  }): ScrollPoint | null {
    return preserveAnchorAfterZoom({
      viewportEl: this.viewportEl,
      anchor: input.anchor,
      nextSnapshot: input.nextSnapshot,
      currentLayoutVersion: input.currentLayoutVersion,
      reason: input.reason,
      hooks: this.hooks,
    });
  }

  preserveAfterLayoutChange(input: {
    anchor: ViewportAnchor;
    nextSnapshot: ViewportSnapshot;
    currentLayoutVersion: LayoutVersion;
    reason?: Extract<
      ScrollReason,
      "view-mode-change" | "resize" | "fit-width" | "fit-page" | "actual-size"
    >;
  }): ScrollPoint | null {
    return preserveAnchorAfterLayoutChange({
      viewportEl: this.viewportEl,
      anchor: input.anchor,
      nextSnapshot: input.nextSnapshot,
      currentLayoutVersion: input.currentLayoutVersion,
      reason: input.reason,
      hooks: this.hooks,
    });
  }

  updateOverflowAndCenter(input: {
    snapshot: ViewportSnapshot;
    logicalCenter: LogicalContentCenter;
    currentLayoutVersion: LayoutVersion;
    tolerance?: number;
    reason?: ScrollReason;
  }): ScrollPoint | null {
    return updateHorizontalOverflowAndCenter({
      viewportEl: this.viewportEl,
      snapshot: input.snapshot,
      logicalCenter: input.logicalCenter,
      currentLayoutVersion: input.currentLayoutVersion,
      tolerance: input.tolerance,
      reason: input.reason,
      hooks: this.hooks,
    });
  }

  commit(
    transaction: ScrollTransaction,
    currentLayoutVersion: LayoutVersion,
  ): ScrollPoint | null {
    return commitScrollTransaction({
      viewportEl: this.viewportEl,
      transaction,
      currentLayoutVersion,
      hooks: this.hooks,
    });
  }
}

/**
 * Exemplo de fluxo correto para Ctrl + wheel:
 *
 * const before = scrollCoordinator.createSnapshot({
 *   contentWidth: currentContentWidth,
 *   contentHeight: currentContentHeight,
 *   layoutVersion,
 * });
 *
 * const anchor = scrollCoordinator.captureWheelAnchor(event, before);
 *
 * setZoom(nextZoom);
 * incrementLayoutVersion();
 *
 * requestAnimationFrame(() => {
 *   const after = scrollCoordinator.createSnapshot({
 *     contentWidth: nextContentWidth,
 *     contentHeight: nextContentHeight,
 *     layoutVersion: nextLayoutVersion,
 *   });
 *
 *   scrollCoordinator.preserveAfterZoom({
 *     anchor,
 *     nextSnapshot: after,
 *     currentLayoutVersion: nextLayoutVersion,
 *     reason: "wheel-zoom",
 *   });
 * });
 */