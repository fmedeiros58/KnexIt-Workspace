import type {
  KnexReadServerTileFallbackResponse,
  KnexReadServerTileRequest,
} from "../../../../knexwriter/src/modules/Knexread/native-pdf-reader/knex-pdf-engine/server-tiles";

const VALID_RENDER_PHASES = new Set([
  "interactive-preview",
  "warmup-preview",
  "settled-final",
]);
const VALID_IMAGE_FORMATS = new Set(["png", "webp", "jpeg"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasPositiveNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return isFiniteNumber(value) && value > 0;
}

function hasNonNegativeNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return isFiniteNumber(value) && value >= 0;
}

function hasString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0;
}

export function isKnexReadTileRendererEnabled() {
  return process.env.KNEXREAD_TILE_RENDERER_ENABLED === "true";
}

export function createTileFallbackResponse(
  reason: string,
  fallback: "tiled-canvas" = "tiled-canvas",
  retryable = true,
): KnexReadServerTileFallbackResponse {
  return {
    ok: false,
    status: "fallback-required",
    fallback,
    reason,
    retryable,
  };
}

export function validateServerTileRequest(
  body: unknown,
): { ok: true; request: KnexReadServerTileRequest } | {
  ok: false;
  errors: string[];
} {
  const errors: string[] = [];

  if (!isRecord(body)) {
    return {
      ok: false,
      errors: ["request-body-must-be-object"],
    };
  }

  if (!hasString(body, "documentId")) errors.push("documentId-required");
  if (
    body.pdfFileId !== undefined &&
    (typeof body.pdfFileId !== "string" ||
      body.pdfFileId.trim().length === 0)
  ) {
    errors.push("pdfFileId-non-empty-string-required");
  }
  if (
    body.pdfUrl !== undefined &&
    (typeof body.pdfUrl !== "string" ||
      !/^https?:\/\//i.test(body.pdfUrl.trim()))
  ) {
    errors.push("pdfUrl-http-url-required");
  }
  if (
    body.pdfBytesBase64 !== undefined &&
    (typeof body.pdfBytesBase64 !== "string" ||
      body.pdfBytesBase64.trim().length === 0)
  ) {
    errors.push("pdfBytesBase64-non-empty-string-required");
  }
  if (
    !hasString(body, "pdfFileId") &&
    !hasString(body, "pdfUrl") &&
    !hasString(body, "pdfBytesBase64")
  ) {
    errors.push("pdf-source-required");
  }
  if (!hasPositiveNumber(body, "pageNumber")) {
    errors.push("pageNumber-positive-number-required");
  }
  if (!hasPositiveNumber(body, "zoom")) errors.push("zoom-positive-required");
  if (!hasPositiveNumber(body, "outputScale")) {
    errors.push("outputScale-positive-required");
  }

  if (
    typeof body.renderPhase !== "string" ||
    !VALID_RENDER_PHASES.has(body.renderPhase)
  ) {
    errors.push("renderPhase-invalid");
  }
  if (
    body.format !== undefined &&
    (typeof body.format !== "string" ||
      !VALID_IMAGE_FORMATS.has(body.format))
  ) {
    errors.push("format-invalid");
  }
  if (
    body.quality !== undefined &&
    (!isFiniteNumber(body.quality) || body.quality < 1 || body.quality > 100)
  ) {
    errors.push("quality-1-100-required");
  }

  const tile = body.tile;
  if (!isRecord(tile)) {
    errors.push("tile-required");
  } else {
    if (!hasNonNegativeNumber(tile, "row")) errors.push("tile.row-invalid");
    if (!hasNonNegativeNumber(tile, "column")) {
      errors.push("tile.column-invalid");
    }
    if (!hasNonNegativeNumber(tile, "cssLeft")) {
      errors.push("tile.cssLeft-invalid");
    }
    if (!hasNonNegativeNumber(tile, "cssTop")) {
      errors.push("tile.cssTop-invalid");
    }
    if (!hasPositiveNumber(tile, "cssWidth")) {
      errors.push("tile.cssWidth-invalid");
    }
    if (!hasPositiveNumber(tile, "cssHeight")) {
      errors.push("tile.cssHeight-invalid");
    }
    if (!hasNonNegativeNumber(tile, "overlapPx")) {
      errors.push("tile.overlapPx-invalid");
    }
  }

  const page = body.page;
  if (!isRecord(page)) {
    errors.push("page-required");
  } else {
    if (!hasPositiveNumber(page, "cssWidth")) {
      errors.push("page.cssWidth-invalid");
    }
    if (!hasPositiveNumber(page, "cssHeight")) {
      errors.push("page.cssHeight-invalid");
    }
    if (!hasPositiveNumber(page, "widthPt")) {
      errors.push("page.widthPt-invalid");
    }
    if (!hasPositiveNumber(page, "heightPt")) {
      errors.push("page.heightPt-invalid");
    }
    if (!isFiniteNumber(page.rotation)) {
      errors.push("page.rotation-invalid");
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    request: body as KnexReadServerTileRequest,
  };
}
