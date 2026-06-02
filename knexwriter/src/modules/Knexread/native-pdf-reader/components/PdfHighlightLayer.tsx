"use client";

import type { PdfHighlightRecord } from "../types";
import { fromNormalizedRect } from "../utils";

const HIGHLIGHT_COLORS: Record<PdfHighlightRecord["color"], string> = {
  yellow: "bg-yellow-300/45",
  green: "bg-emerald-300/40",
  blue: "bg-blue-300/40",
  pink: "bg-pink-300/40",
  purple: "bg-violet-300/40",
  gray: "bg-zinc-300/40",
};

export function PdfHighlightLayer({
  pageNumber,
  pageWidth,
  pageHeight,
  highlights,
  onClickHighlight,
}: {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  highlights: PdfHighlightRecord[];
  onClickHighlight?: (highlight: PdfHighlightRecord) => void;
}) {
  const pageHighlights = highlights.filter(
    (highlight) => highlight.pageNumber === pageNumber,
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {pageHighlights.map((highlight) =>
        highlight.rects.map((rect, index) => {
          const absolute = fromNormalizedRect({
            rect,
            pageWidth,
            pageHeight,
          });

          return (
            <button
              key={`${highlight.id}-${index}`}
              type="button"
              className={`pointer-events-auto absolute rounded-sm ${
                HIGHLIGHT_COLORS[highlight.color]
              }`}
              style={{
                left: `${absolute.x}px`,
                top: `${absolute.y}px`,
                width: `${absolute.width}px`,
                height: `${absolute.height}px`,
              }}
              title={highlight.note || "Destaque"}
              onClick={(event) => {
                event.stopPropagation();
                onClickHighlight?.(highlight);
              }}
            />
          );
        }),
      )}
    </div>
  );
}
