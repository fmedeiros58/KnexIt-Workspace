import type { ScrollMotionAxis, ScrollMotionInput } from "./ZoomScrollTypes";
import {
  ZOOM_SCROLL_SCROLL_FRICTION_PER_16MS,
  ZOOM_SCROLL_SCROLL_MAX_FRAME_DT_MS,
  ZOOM_SCROLL_SCROLL_MAX_VELOCITY_PX_PER_MS,
  ZOOM_SCROLL_SCROLL_MIN_VELOCITY_PX_PER_MS,
  ZOOM_SCROLL_SCROLL_PRIMER_MAX_PX,
  ZOOM_SCROLL_SCROLL_PRIMER_RATIO,
  ZOOM_SCROLL_SCROLL_VELOCITY_IMPULSE,
} from "./ZoomScrollConstants";

/**
 * ScrollMotionController.ts
 * -----------------------------------------------------------------------------
 * Responsabilidade única:
 * scroll comum fluido, separado do zoom.
 *
 * Este arquivo NÃO faz zoom.
 * Este arquivo NÃO confirma render.
 * Este arquivo NÃO renderiza tiles.
 *
 * Modelo:
 * - wheel aplica um pequeno primer imediato;
 * - restante vira velocidade;
 * - RAF move por tempo real entre frames;
 * - velocidade decai em inércia curta.
 */

export type ScrollMotionControllerOptions = {
  viewportEl: HTMLElement;
  onScrollFrame?: () => void;
};

function getNowMs(): number {
  return typeof performance !== "undefined" &&
    typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class ScrollMotionController {
  private readonly viewportEl: HTMLElement;
  private readonly onScrollFrame?: () => void;

  private velocityX = 0;
  private velocityY = 0;
  private frameId: number | null = null;
  private lastFrameAt = 0;

  constructor(options: ScrollMotionControllerOptions) {
    this.viewportEl = options.viewportEl;
    this.onScrollFrame = options.onScrollFrame;
  }

  inject(input: ScrollMotionInput) {
    const delta = Number.isFinite(input.deltaPixels) ? input.deltaPixels : 0;

    if (delta === 0) return;

    const sign = delta < 0 ? -1 : 1;
    const magnitude = Math.abs(delta);

    const primerMagnitude = Math.min(
      magnitude * ZOOM_SCROLL_SCROLL_PRIMER_RATIO,
      ZOOM_SCROLL_SCROLL_PRIMER_MAX_PX,
    );

    const primer = sign * primerMagnitude;
    const remaining = delta - primer;

    this.applyPrimer({
      axis: input.axis,
      value: primer,
    });

    this.injectVelocity({
      axis: input.axis,
      value: remaining * ZOOM_SCROLL_SCROLL_VELOCITY_IMPULSE,
    });

    this.schedule();
  }

  stop() {
    this.velocityX = 0;
    this.velocityY = 0;
    this.lastFrameAt = 0;

    if (this.frameId != null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  dispose() {
    this.stop();
  }

  private applyPrimer(input: { axis: ScrollMotionAxis; value: number }) {
    if (input.axis === "x") {
      this.viewportEl.scrollLeft += input.value;
      return;
    }

    this.viewportEl.scrollTop += input.value;
  }

  private injectVelocity(input: { axis: ScrollMotionAxis; value: number }) {
    if (input.axis === "x") {
      this.velocityX = clamp(
        this.velocityX + input.value,
        -ZOOM_SCROLL_SCROLL_MAX_VELOCITY_PX_PER_MS,
        ZOOM_SCROLL_SCROLL_MAX_VELOCITY_PX_PER_MS,
      );
      return;
    }

    this.velocityY = clamp(
      this.velocityY + input.value,
      -ZOOM_SCROLL_SCROLL_MAX_VELOCITY_PX_PER_MS,
      ZOOM_SCROLL_SCROLL_MAX_VELOCITY_PX_PER_MS,
    );
  }

  private schedule() {
    if (this.frameId != null) return;

    this.lastFrameAt = getNowMs();
    this.frameId = requestAnimationFrame(() => this.frame());
  }

  private frame() {
    const now = getNowMs();
    const dt = clamp(
      now - this.lastFrameAt,
      8,
      ZOOM_SCROLL_SCROLL_MAX_FRAME_DT_MS,
    );

    this.lastFrameAt = now;

    if (Math.abs(this.velocityX) > ZOOM_SCROLL_SCROLL_MIN_VELOCITY_PX_PER_MS) {
      this.viewportEl.scrollLeft += this.velocityX * dt;
    }

    if (Math.abs(this.velocityY) > ZOOM_SCROLL_SCROLL_MIN_VELOCITY_PX_PER_MS) {
      this.viewportEl.scrollTop += this.velocityY * dt;
    }

    this.onScrollFrame?.();

    const friction = Math.pow(
      ZOOM_SCROLL_SCROLL_FRICTION_PER_16MS,
      dt / 16,
    );

    this.velocityX *= friction;
    this.velocityY *= friction;

    const stillMoving =
      Math.abs(this.velocityX) > ZOOM_SCROLL_SCROLL_MIN_VELOCITY_PX_PER_MS ||
      Math.abs(this.velocityY) > ZOOM_SCROLL_SCROLL_MIN_VELOCITY_PX_PER_MS;

    if (stillMoving) {
      this.frameId = requestAnimationFrame(() => this.frame());
      return;
    }

    this.velocityX = 0;
    this.velocityY = 0;
    this.lastFrameAt = 0;
    this.frameId = null;
  }
}
