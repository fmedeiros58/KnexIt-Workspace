import { classifyWheelInput } from "./WheelInputController";
import { computeWheelZoomVelocity } from "./ZoomVelocityController";
import { applyVisualZoomNow } from "./VisualZoomController";
import {
  applyAnchorScrollNow,
  captureZoomAnchor,
  computeAnchorScrollForZoom,
  readViewportMetrics,
} from "./ZoomAnchorOrchestrator";
import type {
  ZoomScrollPipelineResult,
  ZoomScrollWheelLikeEvent,
} from "./ZoomScrollTypes";
import { RenderZoomCommitController } from "./RenderZoomCommitController";
import { ScrollMotionController } from "./ScrollMotionController";

/**
 * ZoomScrollPipeline.ts
 * -----------------------------------------------------------------------------
 * Orquestrador da nova arquitetura.
 *
 * Este é o arquivo que deve ser chamado pelo PdfReaderShell quando formos
 * integrar a refatoração.
 *
 * Fluxo de zoom:
 * wheel event
 * → WheelInputController
 * → ZoomVelocityController
 * → VisualZoomController
 * → ZoomAnchorOrchestrator
 * → RenderZoomCommitController
 *
 * Fluxo de scroll:
 * wheel event
 * → WheelInputController
 * → ScrollMotionController
 *
 * O Shell não deve mais calcular velocidade diretamente.
 */

export type ZoomScrollPipelineOptions = {
  viewportEl: HTMLElement;

  getCurrentVisualZoomPercent: () => number;
  setVisualZoomPercent: (nextZoomPercent: number) => void;

  /**
   * Commit final do render.
   * Normalmente:
   * - setRenderZoom;
   * - setCommittedRenderZoom;
   * - atualizar renderPhase;
   * - liberar tiles/canvas final.
   */
  onCommitRenderZoom: (nextZoomPercent: number) => void;

  /**
   * Chamado quando a interação muda.
   * O Shell pode usar para marcar isZooming/isScrolling.
   */
  onInteraction?: (kind: "zooming" | "scrolling") => void;

  minZoomPercent?: number;
  maxZoomPercent?: number;
  wheelZoomSpeedMultiplier?: number;
};

export class ZoomScrollPipeline {
  private readonly viewportEl: HTMLElement;
  private readonly getCurrentVisualZoomPercent: () => number;
  private readonly setVisualZoomPercent: (nextZoomPercent: number) => void;
  private readonly onCommitRenderZoom: (nextZoomPercent: number) => void;
  private readonly onInteraction?: (kind: "zooming" | "scrolling") => void;

  private readonly minZoomPercent?: number;
  private readonly maxZoomPercent?: number;
  private readonly wheelZoomSpeedMultiplier?: number;

  private readonly scrollMotion: ScrollMotionController;
  private readonly commitController: RenderZoomCommitController;

  constructor(options: ZoomScrollPipelineOptions) {
    this.viewportEl = options.viewportEl;
    this.getCurrentVisualZoomPercent = options.getCurrentVisualZoomPercent;
    this.setVisualZoomPercent = options.setVisualZoomPercent;
    this.onCommitRenderZoom = options.onCommitRenderZoom;
    this.onInteraction = options.onInteraction;
    this.minZoomPercent = options.minZoomPercent;
    this.maxZoomPercent = options.maxZoomPercent;
    this.wheelZoomSpeedMultiplier = options.wheelZoomSpeedMultiplier;

    this.scrollMotion = new ScrollMotionController({
      viewportEl: options.viewportEl,
      onScrollFrame: () => this.onInteraction?.("scrolling"),
    });

    this.commitController = new RenderZoomCommitController({
      onCommit: (result) => {
        this.onCommitRenderZoom(result.committedZoomPercent);
      },
    });
  }

  handleWheel(event: ZoomScrollWheelLikeEvent): ZoomScrollPipelineResult {
    const input = classifyWheelInput(event);

    if (input.shouldPreventDefault) {
      event.preventDefault?.();
    }

    if (input.kind === "vertical-scroll") {
      this.onInteraction?.("scrolling");
      this.scrollMotion.inject({
        axis: "y",
        deltaPixels: input.deltaY,
      });

      return {
        handled: true,
        kind: input.kind,
        audit: {
          source: "ZoomScrollPipeline",
          notes: ["vertical scroll handled by ScrollMotionController"],
        },
      };
    }

    if (input.kind === "horizontal-scroll") {
      this.onInteraction?.("scrolling");
      this.scrollMotion.inject({
        axis: "x",
        deltaPixels: input.deltaX,
      });

      return {
        handled: true,
        kind: input.kind,
        audit: {
          source: "ZoomScrollPipeline",
          notes: ["horizontal scroll handled by ScrollMotionController"],
        },
      };
    }

    if (input.kind !== "wheel-zoom") {
      return {
        handled: false,
        kind: input.kind,
        audit: {
          source: "ZoomScrollPipeline",
          notes: ["wheel ignored"],
        },
      };
    }

    this.onInteraction?.("zooming");

    const previousZoomPercent = this.getCurrentVisualZoomPercent();
    const anchor = captureZoomAnchor({
      viewportEl: this.viewportEl,
      event,
      currentZoomPercent: previousZoomPercent,
    });

    const zoom = computeWheelZoomVelocity({
      currentZoomPercent: previousZoomPercent,
      deltaY: input.deltaY,
      minZoomPercent: this.minZoomPercent,
      maxZoomPercent: this.maxZoomPercent,
      speedMultiplier: this.wheelZoomSpeedMultiplier,
    });

    const visualZoomApplied = applyVisualZoomNow({
      currentVisualZoomPercent: previousZoomPercent,
      nextVisualZoomPercent: zoom.nextZoomPercent,
      reason: "wheel-zoom",
      setVisualZoomPercent: this.setVisualZoomPercent,
    });

    /*
     * Após aplicar visualZoom, o DOM pode ainda não ter recalculado scrollWidth.
     * Nesta versão inicial, usamos o maxScroll atual como aproximação.
     * Na integração com o Shell, podemos plugar métricas reais pós-layout
     * se necessário.
     */
    const metrics = readViewportMetrics(this.viewportEl);
    const anchorScroll = computeAnchorScrollForZoom({
      anchor,
      previousZoomPercent,
      nextZoomPercent: zoom.nextZoomPercent,
      maxScrollLeft: metrics.maxScrollLeft,
      maxScrollTop: metrics.maxScrollTop,
      springStrength: 1,
    });

    applyAnchorScrollNow({
      viewportEl: this.viewportEl,
      scrollLeft: anchorScroll.scrollLeft,
      scrollTop: anchorScroll.scrollTop,
    });

    this.commitController.schedule({
      visualZoomPercent: zoom.nextZoomPercent,
      reason: "wheel-zoom",
    });

    return {
      handled: true,
      kind: input.kind,
      zoom,
      visualZoomApplied,
      anchorScroll,
      audit: {
        source: "ZoomScrollPipeline",
        notes: [
          "wheel zoom handled by modular pipeline",
          "visualZoom applied immediately",
          "renderZoom scheduled for settle",
        ],
      },
    };
  }

  flushRenderCommit() {
    return this.commitController.flush();
  }

  dispose() {
    this.scrollMotion.dispose();
    this.commitController.dispose();
  }
}
