import type { KnexPdfVisualRenderMode } from "./tiles/TileRenderTypes";

export type { KnexPdfVisualRenderMode } from "./tiles/TileRenderTypes";

const VISUAL_RENDER_MODE_KEYS = [
  "KNEX_PDF_VISUAL_RENDER_MODE",
  "__KNEX_PDF_VISUAL_RENDER_MODE__",
] as const;

function normalizeKnexPdfVisualRenderMode(
  value: unknown,
): KnexPdfVisualRenderMode | null {
  return value === "page-canvas" ||
    value === "tiled-canvas" ||
    value === "server-tiled" ||
    value === "auto-professional"
    ? value
    : null;
}

function getGlobalVisualRenderMode(): KnexPdfVisualRenderMode | null {
  const record = globalThis as unknown as Record<string, unknown>;

  for (const key of VISUAL_RENDER_MODE_KEYS) {
    const mode = normalizeKnexPdfVisualRenderMode(record[key]);
    if (mode) return mode;
  }

  return null;
}

function getLocalStorageVisualRenderMode(): KnexPdfVisualRenderMode | null {
  try {
    if (typeof globalThis.localStorage === "undefined") return null;

    return normalizeKnexPdfVisualRenderMode(
      globalThis.localStorage.getItem("KNEX_PDF_VISUAL_RENDER_MODE"),
    );
  } catch {
    return null;
  }
}

function getEnvVisualRenderMode(): KnexPdfVisualRenderMode | null {
  if (typeof process === "undefined") return null;

  return normalizeKnexPdfVisualRenderMode(
    process.env.NEXT_PUBLIC_KNEX_PDF_VISUAL_RENDER_MODE,
  );
}

export function getKnexPdfVisualRenderMode(): KnexPdfVisualRenderMode {
  return (
    getGlobalVisualRenderMode() ??
    getLocalStorageVisualRenderMode() ??
    getEnvVisualRenderMode() ??
    "page-canvas"
  );
}
