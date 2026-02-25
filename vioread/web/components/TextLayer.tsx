"use client";

import { useEffect, useMemo, useRef } from "react";
import type { LayoutBlock } from "../lib/types";
import { px } from "../lib/utils";

type Side = "original" | "translated";

type Props = {
  side: Side;
  blocks: LayoutBlock[];
  selectedBlockId: string | null;
  translatedById?: Record<string, string>;
  maskColor?: string;
  onSelectBlock: (blockId: string, side: Side, pageNumber: number) => void;
  onMeasure?: (values: Record<string, number>) => void;
};

export default function TextLayer({
  side,
  blocks,
  selectedBlockId,
  translatedById,
  maskColor = "#ffffff",
  onSelectBlock,
  onMeasure,
}: Props) {
  const nodeMapRef = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!onMeasure || side !== "translated") return;
    const raf = requestAnimationFrame(() => {
      const next: Record<string, number> = {};
      blocks.forEach((block) => {
        const node = nodeMapRef.current[block.id];
        if (!node) return;
        next[block.id] = node.offsetHeight;
      });
      onMeasure(next);
    });
    return () => cancelAnimationFrame(raf);
  }, [blocks, onMeasure, side, translatedById]);

  const normalizedTranslations = useMemo(() => translatedById ?? {}, [translatedById]);

  return (
    <div className="pointer-events-none absolute inset-0">
      {blocks.map((block) => {
        const translatedText = normalizedTranslations[block.id] ?? block.text;
        const text = side === "translated" ? translatedText : block.text;
        const isSelected = selectedBlockId === block.id;

        return (
          <div
            key={`${side}-${block.id}`}
            data-reader-block-id={block.id}
            ref={(node) => {
              nodeMapRef.current[block.id] = node;
            }}
            role="button"
            tabIndex={0}
            onClick={() => onSelectBlock(block.id, side, block.pageNumber)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectBlock(block.id, side, block.pageNumber);
              }
            }}
            className={`pointer-events-auto absolute cursor-pointer overflow-visible rounded-sm transition ${
              isSelected ? "ring-1 ring-blue-500/60" : "hover:ring-1 hover:ring-blue-400/50"
            }`}
            style={{
              left: px(block.x),
              top: px(block.y),
              width: px(block.width),
              minHeight: px(block.height),
              padding: side === "translated" ? "1px 2px" : "0px",
              background: side === "translated" ? maskColor : "transparent",
              color: side === "translated" ? block.color : "transparent",
              fontFamily: block.fontFamily,
              fontSize: px(block.fontSize),
              fontWeight: block.fontWeight,
              fontStyle: block.fontStyle,
              letterSpacing: `${block.letterSpacing}px`,
              lineHeight: String(block.lineHeight),
              textAlign: block.align,
              whiteSpace: "pre-wrap",
              overflowWrap: "break-word",
              userSelect: "text",
            }}
            title={`Bloco ${block.readingOrder + 1}`}
          >
            {text}
          </div>
        );
      })}
    </div>
  );
}

