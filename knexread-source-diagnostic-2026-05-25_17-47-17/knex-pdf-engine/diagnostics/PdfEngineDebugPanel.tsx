"use client";

import type { RenderDebugInfo } from "./RenderDebugInfo";

export function PdfEngineDebugPanel({
  visible,
  info,
}: {
  visible: boolean;
  info?: RenderDebugInfo;
}) {
  if (!visible || !info || process.env.NODE_ENV === "production") return null;

  return (
    <aside className="pointer-events-none fixed bottom-3 right-3 z-[100] max-w-sm rounded border border-zinc-700 bg-zinc-950/90 p-3 text-[11px] text-zinc-100 shadow-xl">
      <p className="font-semibold">KnexPDF Engine</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
        <dt>Backend</dt>
        <dd>{info.backend}</dd>
        <dt>Page</dt>
        <dd>{info.pageNumber}</dd>
        <dt>CSS</dt>
        <dd>{Math.round(info.cssWidth)} x {Math.round(info.cssHeight)}</dd>
        <dt>Canvas</dt>
        <dd>{info.canvasWidth} x {info.canvasHeight}</dd>
        <dt>Output</dt>
        <dd>{info.outputScale.toFixed(2)}</dd>
        <dt>Quality</dt>
        <dd>{info.renderQuality}</dd>
      </dl>
    </aside>
  );
}
