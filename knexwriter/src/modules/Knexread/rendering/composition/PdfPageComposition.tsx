"use client";

import type { ReactNode } from "react";

export type PdfPagePipelineMode =
  | "blueprint"
  | "legacy-tiled-canvas"
  | "single-canvas-html-text"
  | "tiled-canvas";

function safeDimension(value: number, fallback = 1): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, value)
    : fallback;
}

/**
 * PdfPageComposition
 * ------------------------------------------------------------
 * Compositor visual rígido da página.
 *
 * Este componente não deve calcular zoom, renderizar texto ou renderizar canvas.
 * Sua função é garantir que todas as camadas filhas compartilhem exatamente
 * a mesma caixa visual durante zoom e rolagem.
 *
 * Ponto importante:
 * - não usamos "absolute inset-0" como única regra de geometria;
 * - travamos width/minWidth/maxWidth e height/minHeight/maxHeight;
 * - isso reduz oscilação horizontal durante scroll/zoom e evita que uma camada
 *   expanda/encolha antes da outra.
 */
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
  const safeWidth = safeDimension(width);
  const safeHeight = safeDimension(height);

  return (
    <div
      className="absolute left-0 top-0"
      data-knexread-page-composition="true"
      data-knexread-page-pipeline={mode}
      data-knexread-page-composition-width={safeWidth}
      data-knexread-page-composition-height={safeHeight}
      style={{
        width: `${safeWidth}px`,
        minWidth: `${safeWidth}px`,
        maxWidth: `${safeWidth}px`,
        height: `${safeHeight}px`,
        minHeight: `${safeHeight}px`,
        maxHeight: `${safeHeight}px`,
        flex: `0 0 ${safeWidth}px`,
        position: "absolute",
        left: 0,
        top: 0,
        overflow: "hidden",
        contain: "layout paint size",
        boxSizing: "border-box",
        transform: "translateZ(0)",
        transformOrigin: "0 0",
      }}
    >
      {children}
    </div>
  );
}
