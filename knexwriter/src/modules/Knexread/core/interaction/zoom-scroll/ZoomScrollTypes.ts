/**
 * ZoomScrollTypes.ts
 * -----------------------------------------------------------------------------
 * Tipos centrais da nova arquitetura de zoom/scroll do Knexread.
 *
 * Este arquivo NÃO executa lógica.
 * Ele existe para tornar auditável a comunicação entre os módulos:
 *
 * 1. WheelInputController
 *    Recebe o WheelEvent e classifica a intenção do usuário.
 *
 * 2. ZoomVelocityController
 *    Converte delta de wheel em próximo percentual de zoom.
 *
 * 3. VisualZoomController
 *    Aplica visualZoom imediatamente, sem disparar render pesado.
 *
 * 4. ZoomAnchorOrchestrator
 *    Mantém o ponto visual preso durante a mudança de zoom.
 *
 * 5. RenderZoomCommitController
 *    Confirma renderZoom somente após estabilização do gesto.
 *
 * 6. ScrollMotionController
 *    Controla scroll comum, separado do zoom.
 *
 * Regra arquitetural:
 * - velocidade do zoom não deve ficar em PdfReaderShell;
 * - velocidade do zoom não deve ficar em PdfZoomFramePolicy;
 * - velocidade do zoom não deve ficar espalhada em hooks;
 * - o Shell deve apenas orquestrar.
 */

export type ZoomScrollDeltaMode = 0 | 1 | 2 | number;

export type ZoomScrollWheelLikeEvent = {
  deltaX?: number;
  deltaY: number;
  deltaMode?: ZoomScrollDeltaMode;

  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;

  clientX?: number;
  clientY?: number;

  preventDefault?: () => void;
  stopPropagation?: () => void;
};

export type ZoomScrollInputKind =
  | "wheel-zoom"
  | "vertical-scroll"
  | "horizontal-scroll"
  | "ignored";

export type ZoomDirection = "in" | "out" | "none";

export type ZoomScrollReason =
  | "wheel-zoom"
  | "pinch-zoom"
  | "manual"
  | "preset"
  | "fit-width"
  | "fit-page"
  | "actual-size"
  | "restore";

export type ZoomScrollPoint = {
  x: number;
  y: number;
};

export type ZoomScrollSize = {
  width: number;
  height: number;
};

export type ZoomScrollRect = ZoomScrollPoint & ZoomScrollSize;

export type ZoomScrollViewportMetrics = {
  viewportWidth: number;
  viewportHeight: number;

  scrollLeft: number;
  scrollTop: number;

  scrollWidth: number;
  scrollHeight: number;

  maxScrollLeft: number;
  maxScrollTop: number;
};

export type WheelInputClassification = {
  kind: ZoomScrollInputKind;

  /**
   * Delta normalizado em pixels.
   *
   * Importante:
   * - esta etapa ainda NÃO aplica velocidade de zoom;
   * - velocidade pertence ao ZoomVelocityController.
   */
  deltaX: number;
  deltaY: number;

  /**
   * Direção interpretada para zoom.
   *
   * Padrão de navegador:
   * - deltaY < 0 normalmente aproxima;
   * - deltaY > 0 normalmente afasta.
   */
  zoomDirection: ZoomDirection;

  pointerClientX?: number;
  pointerClientY?: number;

  usedModifier: "ctrl" | "meta" | "none";
  shouldPreventDefault: boolean;

  audit: {
    source: "WheelInputController";
    reason: string;
    rawDeltaX: number;
    rawDeltaY: number;
    deltaMode: ZoomScrollDeltaMode;
  };
};

export type ZoomVelocityInput = {
  currentZoomPercent: number;
  deltaY: number;

  minZoomPercent?: number;
  maxZoomPercent?: number;

  /**
   * Multiplicador central do wheel.
   * Deve morar aqui, não no Shell.
   */
  speedMultiplier?: number;

  /**
   * Quando true, inverte o sentido do wheel.
   */
  invertDirection?: boolean;
};

export type ZoomVelocityResult = {
  previousZoomPercent: number;
  nextZoomPercent: number;
  deltaZoomPercent: number;
  direction: ZoomDirection;
  clamped: boolean;

  /**
   * Fator multiplicativo usado internamente.
   * Exemplo: 1.5 significa +50%; 0.5 significa -50%.
   */
  appliedFactor: number;

  audit: {
    source: "ZoomVelocityController";
    effectiveDeltaY: number;
    effectiveNotches: number;
    speedMultiplier: number;
    highZoomReturnBoost: number;
    nearLimitBrake: number;
  };
};

export type VisualZoomApplyInput = {
  currentVisualZoomPercent: number;
  nextVisualZoomPercent: number;
  reason: ZoomScrollReason;

  /**
   * Callback normalmente ligado ao setVisualZoom do PdfReaderShell.
   */
  setVisualZoomPercent: (nextZoomPercent: number) => void;

  nowMs?: number;
};

export type VisualZoomApplyResult = {
  previousVisualZoomPercent: number;
  nextVisualZoomPercent: number;
  changed: boolean;
  appliedAtMs: number;

  audit: {
    source: "VisualZoomController";
    reason: ZoomScrollReason;
  };
};

export type ZoomAnchorSnapshot = {
  viewportWidth: number;
  viewportHeight: number;

  scrollLeft: number;
  scrollTop: number;

  maxScrollLeft: number;
  maxScrollTop: number;

  /**
   * Ponto do viewport que deve permanecer preso ao conteúdo.
   * Para wheel, geralmente é o cursor.
   */
  anchorViewportX: number;
  anchorViewportY: number;

  /**
   * Coordenada absoluta do conteúdo no momento ANTES do zoom.
   */
  contentX: number;
  contentY: number;

  capturedZoomPercent: number;
  capturedAtMs: number;
};

export type ZoomAnchorApplyInput = {
  anchor: ZoomAnchorSnapshot;

  previousZoomPercent: number;
  nextZoomPercent: number;

  maxScrollLeft: number;
  maxScrollTop: number;

  /**
   * Força de correção.
   * 1 = mola direta, sem curva lenta.
   */
  springStrength?: number;
};

export type ZoomAnchorApplyResult = {
  scrollLeft: number;
  scrollTop: number;

  audit: {
    source: "ZoomAnchorOrchestrator";
    zoomRatio: number;
    springStrength: number;
  };
};

export type RenderZoomCommitRequest = {
  visualZoomPercent: number;
  reason: ZoomScrollReason;
  requestedAtMs: number;
};

export type RenderZoomCommitResult = {
  committedZoomPercent: number;
  reason: ZoomScrollReason;
  committedAtMs: number;

  audit: {
    source: "RenderZoomCommitController";
    settleMs: number;
  };
};

export type ScrollMotionAxis = "x" | "y";

export type ScrollMotionInput = {
  axis: ScrollMotionAxis;
  deltaPixels: number;
};

export type ZoomScrollInteractionPhase =
  | "idle"
  | "scrolling"
  | "zooming"
  | "settling";

export type ZoomScrollInteractionSnapshot = {
  phase: ZoomScrollInteractionPhase;
  isWheelActive: boolean;
  isZooming: boolean;
  isScrolling: boolean;

  lastWheelAtMs: number;
  lastZoomAtMs: number;
  lastScrollAtMs: number;

  settleDeadlineMs: number;
};

export type ZoomScrollPipelineResult = {
  handled: boolean;
  kind: ZoomScrollInputKind;

  zoom?: ZoomVelocityResult;
  visualZoomApplied?: VisualZoomApplyResult;

  anchorScroll?: ZoomAnchorApplyResult;

  audit: {
    source: "ZoomScrollPipeline";
    notes: string[];
  };
};
