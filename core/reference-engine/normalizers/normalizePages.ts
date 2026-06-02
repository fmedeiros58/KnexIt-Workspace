import type { PageRange } from "../core/BibliographicSource";

export function normalizePages(pages: PageRange | string | undefined): PageRange | undefined {
  if (!pages) return undefined;
  if (typeof pages === "string") {
    const cleaned = pages.trim();
    if (!cleaned) return undefined;
    const match = cleaned.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (match) {
      return { start: match[1], end: match[2], raw: cleaned };
    }
    return { raw: cleaned };
  }

  const start = pages.start?.trim();
  const end = pages.end?.trim();
  const raw = pages.raw?.trim();
  if (!start && !end && !raw) return undefined;
  return {
    start,
    end,
    raw,
  };
}

export function formatPagesRange(pages: PageRange | undefined): string {
  if (!pages) return "";
  if (pages.start && pages.end) return `${pages.start}-${pages.end}`;
  if (pages.start) return pages.start;
  if (pages.end) return pages.end;
  return pages.raw || "";
}

