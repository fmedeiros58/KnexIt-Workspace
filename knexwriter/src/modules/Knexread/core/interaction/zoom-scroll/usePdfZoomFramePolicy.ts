import { useMemo } from "react";
import {
  resolvePdfZoomFramePolicy,
  type PdfZoomFramePolicy,
  type PdfZoomFramePolicyInput,
} from "./PdfZoomFramePolicy";

/**
 * Hook central da política de zoom/scroll do Knexread.
 *
 * Ele não deve executar lógica visual diretamente.
 * Sua função é estabilizar os parâmetros vindos do PdfPageView
 * e delegar a decisão para resolvePdfZoomFramePolicy.
 *
 * Regra importante:
 * - zoom/scroll podem suspender interação fina;
 * - mas não devem desmontar o texto visual da página.
 */
export function usePdfZoomFramePolicy(
  input: PdfZoomFramePolicyInput,
): PdfZoomFramePolicy {
  const baseWidth = input.basePageSize.width;
  const baseHeight = input.basePageSize.height;

  const zoom = input.zoom;
  const renderPhase = input.renderPhase;
  const isZooming = input.isZooming;
  const isScrolling = input.isScrolling;
  const isWarmupPage = input.isWarmupPage;
  const showTextLayer = input.showTextLayer;
  const enableSelection = input.enableSelection;
  const modularPagePipelineEnabled = input.modularPagePipelineEnabled;
  const blueprintPagePipelineEnabled = input.blueprintPagePipelineEnabled;
  const minLayoutScale = input.minLayoutScale;
  const maxLayoutScale = input.maxLayoutScale;

  /*
   * Multiplicadores opcionais definidos em PdfZoomFramePolicyInput.
   *
   * O padrão real continua sendo resolvido dentro de PdfZoomFramePolicy.ts.
   * Aqui apenas estabilizamos os valores para o useMemo.
   */
  const wheelScrollMultiplier = input.wheelScrollMultiplier;
  const wheelZoomMultiplier = input.wheelZoomMultiplier;

  return useMemo(
    () =>
      resolvePdfZoomFramePolicy({
        zoom,
        basePageSize: {
          width: baseWidth,
          height: baseHeight,
        },
        renderPhase,
        isZooming,
        isScrolling,
        isWarmupPage,
        showTextLayer,
        enableSelection,
        modularPagePipelineEnabled,
        blueprintPagePipelineEnabled,
        minLayoutScale,
        maxLayoutScale,
        wheelScrollMultiplier,
        wheelZoomMultiplier,
      }),
    [
      zoom,
      baseWidth,
      baseHeight,
      renderPhase,
      isZooming,
      isScrolling,
      isWarmupPage,
      showTextLayer,
      enableSelection,
      modularPagePipelineEnabled,
      blueprintPagePipelineEnabled,
      minLayoutScale,
      maxLayoutScale,
      wheelScrollMultiplier,
      wheelZoomMultiplier,
    ],
  );
}