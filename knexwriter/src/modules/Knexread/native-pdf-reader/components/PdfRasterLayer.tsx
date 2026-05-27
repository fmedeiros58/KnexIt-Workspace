"use client";

import {
  PdfPageCanvas,
  type PdfPageCanvasProps,
} from "./PdfPageCanvas";

export type PdfRasterLayerProps = PdfPageCanvasProps & {
  cssWidth: number;
  cssHeight: number;
  hiddenUntilTextlessRender?: boolean;
  delayedUntilTextExtraction?: boolean;
};

export function PdfRasterLayer({
  cssWidth,
  cssHeight,
  hiddenUntilTextlessRender = false,
  delayedUntilTextExtraction = false,
  ...canvasProps
}: PdfRasterLayerProps) {
  return (
    <div
      className="absolute inset-0 z-0"
      data-knexread-page-raster-layer="true"
      data-knexread-page-visual-layer="true"
      style={{
        width: `${cssWidth}px`,
        height: `${cssHeight}px`,
        opacity: hiddenUntilTextlessRender ? 0 : 1,
        visibility: hiddenUntilTextlessRender ? "hidden" : "visible",
      }}
    >
      {!delayedUntilTextExtraction ? (
        <PdfPageCanvas {...canvasProps} />
      ) : (
        <div
          className="absolute inset-0 rounded border border-zinc-300 bg-white shadow-sm"
          data-knexread-page-placeholder="true"
          style={{
            width: `${cssWidth}px`,
            height: `${cssHeight}px`,
          }}
        />
      )}
    </div>
  );
}
