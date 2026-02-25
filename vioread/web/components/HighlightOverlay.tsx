"use client";

import type { LayoutBlock } from "../lib/types";

type Props = {
  block: LayoutBlock | null;
};

export default function HighlightOverlay({ block }: Props) {
  if (!block) return null;

  return (
    <div
      className="pointer-events-none absolute rounded-[3px] border-2 border-blue-500/90 bg-blue-200/20"
      style={{
        left: `${block.x}px`,
        top: `${block.y}px`,
        width: `${Math.max(2, block.width)}px`,
        height: `${Math.max(2, block.height)}px`,
      }}
    />
  );
}

