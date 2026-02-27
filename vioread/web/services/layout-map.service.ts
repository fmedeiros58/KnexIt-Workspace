import { PAGE_LINE_MERGE_TOLERANCE, PAGE_TEXT_PADDING } from "../lib/constants";
import { clamp, normalizeWhitespace } from "../lib/utils";
import type { LayoutBlock } from "../lib/types";

type RawPdfTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName?: string;
};

type RawPdfStyle = {
  fontFamily?: string;
};

type BuildLayoutArgs = {
  pageNumber: number;
  viewportWidth: number;
  viewportHeight: number;
  viewportScale: number;
  viewportTransform: number[];
  items: RawPdfTextItem[];
  styles: Record<string, RawPdfStyle>;
  utilTransform: (a: number[], b: number[]) => number[];
};

type TempLine = {
  y: number;
  minY: number;
  maxY: number;
  minX: number;
  maxX: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: "normal" | "italic";
  color: string;
  parts: Array<{ x: number; text: string }>;
};

function inferFontWeight(fontName?: string) {
  const raw = (fontName ?? "").toLowerCase();
  if (raw.includes("bold") || raw.includes("black") || raw.includes("heavy")) return "700";
  return "400";
}

function inferFontStyle(fontName?: string): "normal" | "italic" {
  const raw = (fontName ?? "").toLowerCase();
  return raw.includes("italic") || raw.includes("oblique") ? "italic" : "normal";
}

export function buildLayoutBlocksFromPdfText(args: BuildLayoutArgs): LayoutBlock[] {
  const prepared = args.items
    .map((item) => {
      const text = normalizeWhitespace(item.str ?? "");
      if (!text) return null;

      const tx = args.utilTransform(args.viewportTransform, item.transform);

      const style = args.styles[item.fontName ?? ""];
      const fontFamily = style?.fontFamily ?? "serif";
      const fontSize = Math.max(8, Math.hypot(tx[2] ?? 0, tx[3] ?? 0));
      const x = clamp((tx[4] ?? 0) - PAGE_TEXT_PADDING, 0, args.viewportWidth);
      const y = clamp((tx[5] ?? 0) - fontSize, 0, args.viewportHeight);
      const width = clamp((item.width || 0) * args.viewportScale + PAGE_TEXT_PADDING * 2, 8, args.viewportWidth - x);
      const height = Math.max(fontSize * 1.12, (item.height || 0) * args.viewportScale);

      return {
        text,
        x,
        y,
        width,
        height,
        fontFamily,
        fontSize,
        fontWeight: inferFontWeight(item.fontName),
        fontStyle: inferFontStyle(item.fontName),
        color: "#111111",
      };
    })
    .filter(Boolean) as Array<{
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    fontStyle: "normal" | "italic";
    color: string;
  }>;

  prepared.sort((a, b) => {
    const yDiff = Math.abs(a.y - b.y);
    if (yDiff > 1.5) return a.y - b.y;
    return a.x - b.x;
  });

  const lines: TempLine[] = [];

  prepared.forEach((entry) => {
    const tolerance = Math.max(PAGE_LINE_MERGE_TOLERANCE, entry.fontSize * 0.45);
    const targetLine = lines.find((line) => Math.abs(line.y - entry.y) <= tolerance);

    if (targetLine) {
      targetLine.parts.push({ x: entry.x, text: entry.text });
      targetLine.minX = Math.min(targetLine.minX, entry.x);
      targetLine.maxX = Math.max(targetLine.maxX, entry.x + entry.width);
      targetLine.minY = Math.min(targetLine.minY, entry.y);
      targetLine.maxY = Math.max(targetLine.maxY, entry.y + entry.height);
      return;
    }

    lines.push({
      y: entry.y,
      minY: entry.y,
      maxY: entry.y + entry.height,
      minX: entry.x,
      maxX: entry.x + entry.width,
      fontFamily: entry.fontFamily,
      fontSize: entry.fontSize,
      fontWeight: entry.fontWeight,
      fontStyle: entry.fontStyle,
      color: entry.color,
      parts: [{ x: entry.x, text: entry.text }],
    });
  });

  lines.sort((a, b) => (a.minY !== b.minY ? a.minY - b.minY : a.minX - b.minX));

  return lines.map((line, lineIndex) => {
    const orderedParts = [...line.parts].sort((a, b) => a.x - b.x).map((part) => part.text);
    const text = normalizeWhitespace(orderedParts.join(" "));
    const width = Math.max(8, line.maxX - line.minX);
    const height = Math.max(12, line.maxY - line.minY);

    return {
      id: `p${args.pageNumber}-b${lineIndex + 1}`,
      pageNumber: args.pageNumber,
      text,
      x: line.minX,
      y: line.minY,
      width,
      height,
      fontFamily: line.fontFamily,
      fontSize: line.fontSize,
      fontWeight: line.fontWeight,
      fontStyle: line.fontStyle,
      color: line.color,
      align: "left",
      lineHeight: Math.max(1.18, height / Math.max(line.fontSize, 1)),
      letterSpacing: 0,
      readingOrder: lineIndex,
      lineIndex,
      paragraphIndex: lineIndex,
    };
  });
}

