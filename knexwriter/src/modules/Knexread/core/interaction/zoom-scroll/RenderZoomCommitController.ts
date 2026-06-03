import type {
  RenderZoomCommitRequest,
  RenderZoomCommitResult,
  ZoomScrollReason,
} from "./ZoomScrollTypes";
import { ZOOM_SCROLL_RENDER_COMMIT_SETTLE_MS } from "./ZoomScrollConstants";

/**
 * RenderZoomCommitController.ts
 * -----------------------------------------------------------------------------
 * Responsabilidade única:
 * confirmar renderZoom/committedRenderZoom depois que o gesto estabiliza.
 *
 * Regra arquitetural:
 * - visualZoom muda imediatamente;
 * - renderZoom NÃO muda durante wheel ativo;
 * - committedRenderZoom só muda no settle;
 * - tiles/canvas renderizam depois do commit.
 */

export type RenderZoomCommitControllerOptions = {
  settleMs?: number;
  onCommit: (result: RenderZoomCommitResult) => void;
};

function getNowMs(): number {
  return typeof performance !== "undefined" &&
    typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

export class RenderZoomCommitController {
  private readonly settleMs: number;
  private readonly onCommit: (result: RenderZoomCommitResult) => void;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private pendingRequest: RenderZoomCommitRequest | null = null;

  constructor(options: RenderZoomCommitControllerOptions) {
    this.settleMs = Math.max(
      0,
      options.settleMs ?? ZOOM_SCROLL_RENDER_COMMIT_SETTLE_MS,
    );
    this.onCommit = options.onCommit;
  }

  schedule(input: {
    visualZoomPercent: number;
    reason: ZoomScrollReason;
    nowMs?: number;
  }) {
    const requestedAtMs =
      typeof input.nowMs === "number" && Number.isFinite(input.nowMs)
        ? input.nowMs
        : getNowMs();

    this.pendingRequest = {
      visualZoomPercent: input.visualZoomPercent,
      reason: input.reason,
      requestedAtMs,
    };

    this.cancelTimerOnly();

    this.timeoutId = setTimeout(() => {
      this.flush();
    }, this.settleMs);
  }

  flush(): RenderZoomCommitResult | null {
    const request = this.pendingRequest;

    this.cancelTimerOnly();
    this.pendingRequest = null;

    if (!request) {
      return null;
    }

    const result: RenderZoomCommitResult = {
      committedZoomPercent: request.visualZoomPercent,
      reason: request.reason,
      committedAtMs: getNowMs(),
      audit: {
        source: "RenderZoomCommitController",
        settleMs: this.settleMs,
      },
    };

    this.onCommit(result);

    return result;
  }

  cancel() {
    this.cancelTimerOnly();
    this.pendingRequest = null;
  }

  dispose() {
    this.cancel();
  }

  private cancelTimerOnly() {
    if (this.timeoutId == null) return;

    clearTimeout(this.timeoutId);
    this.timeoutId = null;
  }
}
