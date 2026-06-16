import type {
  VisualZoomApplyInput,
  VisualZoomApplyResult,
} from "./ZoomScrollTypes";
import { ZOOM_SCROLL_ASSIGNMENT_EPSILON } from "./ZoomScrollConstants";

/**
 * VisualZoomController.ts
 * -----------------------------------------------------------------------------
 * Responsabilidade única:
 * aplicar visualZoom imediatamente.
 *
 * Este arquivo NÃO calcula velocidade.
 * Este arquivo NÃO confirma renderZoom.
 * Este arquivo NÃO renderiza tiles.
 * Este arquivo NÃO restaura âncora.
 *
 * visualZoom é a resposta visual instantânea do palco.
 * renderZoom/committedRenderZoom ficam para RenderZoomCommitController.
 */

function getNowMs(input?: number): number {
  if (typeof input === "number" && Number.isFinite(input)) return input;

  return typeof performance !== "undefined" &&
    typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

export function applyVisualZoomNow(
  input: VisualZoomApplyInput,
): VisualZoomApplyResult {
  const previousVisualZoomPercent = input.currentVisualZoomPercent;
  const nextVisualZoomPercent = input.nextVisualZoomPercent;

  const changed =
    Math.abs(previousVisualZoomPercent - nextVisualZoomPercent) >
    ZOOM_SCROLL_ASSIGNMENT_EPSILON;

  if (changed) {
    /*
     * Este callback deve ser barato:
     * normalmente setVisualZoomPercent ou setVisualZoom.
     *
     * Regra:
     * não chamar setCommittedRenderZoom aqui.
     */
    input.setVisualZoomPercent(nextVisualZoomPercent);
  }

  return {
    previousVisualZoomPercent,
    nextVisualZoomPercent,
    changed,
    appliedAtMs: getNowMs(input.nowMs),
    audit: {
      source: "VisualZoomController",
      reason: input.reason,
    },
  };
}
