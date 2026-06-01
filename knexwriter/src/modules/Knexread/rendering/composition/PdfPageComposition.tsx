"use client";

import type { ReactNode } from "react";

export type PdfPagePipelineMode =
  | "legacy-tiled-canvas"
  | "single-canvas-html-text";

export function PdfPageComposition({
  width,
  height,
  mode,
  children,
}: {
  width: number;
  height: number;
  mode: PdfPagePipelineMode;
  children: ReactNode;
}) {
  return (
    <div
      className="absolute inset-0"
      data-knexread-page-composition="true"
      data-knexread-page-pipeline={mode}
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      {children}
    </div>
  );
}
