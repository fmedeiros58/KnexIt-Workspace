import { useCallback, useMemo } from "react";
import {
  useKnexPdfEngine,
  useKnexPdfEngineState,
} from "../knex-pdf-engine/KnexPdfEngineProvider";

export function usePdfZoom() {
  const engine = useKnexPdfEngine();
  const engineState = useKnexPdfEngineState();

  const zoomScale = engineState.zoom;
  const zoom = Math.round(zoomScale * 100);

  const setZoom = useCallback(
    (value: number) => {
      return engine.setZoomPercent(value, {
        reason: "manual-percent",
      });
    },
    [engine],
  );

  const setZoomScale = useCallback(
    (scale: number) => {
      return engine.setZoom(scale, {
        reason: "manual-scale",
      });
    },
    [engine],
  );

  const setZoomFromInput = useCallback(
    (value: string | number) => {
      return engine.setZoomPercent(value, {
        reason: "manual-percent",
      });
    },
    [engine],
  );

  const zoomIn = useCallback(() => {
    return engine.zoomIn();
  }, [engine]);

  const zoomOut = useCallback(() => {
    return engine.zoomOut();
  }, [engine]);

  const actualSize = useCallback(() => {
    return engine.actualSize();
  }, [engine]);

  const fitWidth = useCallback(
    (input: {
      viewportWidth: number;
      viewportHeight: number;
      pageWidth: number;
      pageHeight: number;
      paddingX?: number;
      paddingY?: number;
    }) => {
      return engine.fitWidth(input);
    },
    [engine],
  );

  const fitPage = useCallback(
    (input: {
      viewportWidth: number;
      viewportHeight: number;
      pageWidth: number;
      pageHeight: number;
      paddingX?: number;
      paddingY?: number;
    }) => {
      return engine.fitPage(input);
    },
    [engine],
  );

  const wheelZoom = useCallback(
    (input: {
      deltaY: number;
      deltaMode?: number;
      sensitivity?: number;
      invertDirection?: boolean;
    }) => {
      return engine.wheelZoom(input);
    },
    [engine],
  );

  const zoomLabel = useMemo(() => `${zoom}%`, [zoom]);

  return {
    zoom,
    zoomScale,
    zoomLabel,

    minZoom: 10,
    maxZoom: 8000,

    setZoom,
    setZoomScale,
    setZoomFromInput,

    zoomIn,
    zoomOut,
    wheelZoom,
    actualSize,
    fitWidth,
    fitPage,
  };
}
