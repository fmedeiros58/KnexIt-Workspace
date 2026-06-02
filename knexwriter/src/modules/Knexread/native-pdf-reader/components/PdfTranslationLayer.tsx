"use client";

import { useMemo } from "react";
import type { PdfTranslationBlockRecord } from "../types";
import { reconstructTranslationBlocks } from "../services";

export function PdfTranslationLayer({
  pageNumber,
  blocks,
  showMask,
  maskOpacity,
  showBlockBounds,
  editable = true,
  focusedBlockId,
  onUpdateBlock,
}: {
  pageNumber: number;
  blocks: PdfTranslationBlockRecord[];
  showMask: boolean;
  maskOpacity: number;
  showBlockBounds: boolean;
  editable?: boolean;
  focusedBlockId?: string;
  onUpdateBlock?: (translationBlockId: string, text: string) => void;
}) {
  const pageBlocks = useMemo(
    () => blocks.filter((block) => block.pageNumber === pageNumber),
    [blocks, pageNumber],
  );

  const reconstructed = useMemo(
    () =>
      reconstructTranslationBlocks({
        blocks: pageBlocks,
        maskOpacity,
      }),
    [maskOpacity, pageBlocks],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {reconstructed.blocks.map((block) => {
        const source = pageBlocks.find((item) => item.id === block.translationBlockId);
        if (!source) return null;
        const isFocused = focusedBlockId && source.id === focusedBlockId;
        return (
          <div
            key={source.id}
            className={`pointer-events-auto absolute rounded-sm ${
              isFocused ? "ring-2 ring-blue-400 ring-offset-1" : ""
            } ${showBlockBounds ? "border border-blue-300/80" : ""}`}
            style={{
              left: `${block.mask.x}px`,
              top: `${block.mask.y}px`,
              width: `${block.mask.width}px`,
              minHeight: `${block.mask.height}px`,
              background: showMask
                ? `rgba(255,255,255,${Math.min(1, Math.max(0, block.mask.opacity))})`
                : "transparent",
              padding: "2px 3px",
            }}
          >
            <div
              className={`w-full whitespace-pre-wrap outline-none ${
                editable ? "cursor-text" : "cursor-default"
              }`}
              contentEditable={editable}
              suppressContentEditableWarning
              onBlur={(event) => {
                if (!editable) return;
                const nextText = event.currentTarget.textContent ?? "";
                if (nextText !== source.translatedText) {
                  onUpdateBlock?.(source.id, nextText);
                }
              }}
              style={{
                fontSize: `${block.fit.fontSize}px`,
                fontFamily: source.style.fontFamily ?? "serif",
                fontWeight: source.style.fontWeight ?? "400",
                fontStyle: source.style.fontStyle ?? "normal",
                lineHeight: `${block.fit.lineHeight}px`,
                color: source.style.color ?? "#111111",
                textAlign: source.style.alignment ?? "left",
                minHeight: `${block.mask.height - 4}px`,
              }}
            >
              {source.translatedText}
            </div>
            {block.fit.overflow ? (
              <span className="absolute -right-1 -top-1 rounded bg-rose-500 px-1 text-[9px] font-semibold text-white">
                !
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
