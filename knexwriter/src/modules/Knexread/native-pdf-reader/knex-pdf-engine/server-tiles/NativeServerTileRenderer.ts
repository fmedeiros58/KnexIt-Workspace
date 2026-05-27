import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { join } from "path";
import type {
  KnexReadServerTileRequest,
  KnexReadServerTileFormat,
  KnexReadServerTileResponse,
} from "./ServerTileTypes";

export type NativeServerTileRenderResult = {
  response: KnexReadServerTileResponse;
  status: number;
};

function createFallbackResponse(input: {
  reason: string;
  retryable?: boolean;
  status?: number;
}): NativeServerTileRenderResult {
  return {
    status: input.status ?? 501,
    response: {
      ok: false,
      status: "fallback-required",
      fallback: "tiled-canvas",
      reason: input.reason,
      retryable: input.retryable ?? false,
    },
  };
}

function getConfiguredRendererEngine(): string {
  return process.env.KNEXREAD_TILE_RENDERER_ENGINE?.trim() || "pdfium-native";
}

function isNativeTileEncoderEnabled(): boolean {
  return process.env.KNEXREAD_TILE_NATIVE_ENCODER_ENABLED === "true";
}

type NapiCanvasModule = {
  createCanvas: (width: number, height: number) => {
    width: number;
    height: number;
    getContext: (contextId: "2d") => unknown;
    encodeSync: (format: "png" | "webp" | "jpeg", quality?: number) => Buffer;
  };
  DOMMatrix?: unknown;
  DOMPoint?: unknown;
  ImageData?: unknown;
  Path2D?: unknown;
};

type PdfJsViewport = {
  width: number;
  height: number;
};

type PdfJsRenderTask = {
  promise: Promise<void>;
  cancel?: () => void;
};

type PdfJsPage = {
  getViewport: (params: { scale: number; rotation?: number }) => PdfJsViewport;
  render: (params: {
    canvasContext: unknown;
    viewport: PdfJsViewport;
    transform: number[];
    intent: "display";
  }) => PdfJsRenderTask;
};

type PdfJsDocument = {
  getPage: (pageNumber: number) => Promise<PdfJsPage>;
  destroy?: () => Promise<void> | void;
};

type PdfJsModule = {
  getDocument: (input: unknown) => {
    promise: Promise<PdfJsDocument>;
    destroy?: () => Promise<void> | void;
  };
};

function getRequire(): (specifier: string) => unknown {
  return (0, eval)("require") as (specifier: string) => unknown;
}

async function importPdfJsModule(): Promise<PdfJsModule> {
  const dynamicImport = new Function(
    "specifier",
    "return import(specifier)",
  ) as (specifier: string) => Promise<unknown>;

  return (await dynamicImport("pdfjs-dist/legacy/build/pdf.mjs")) as PdfJsModule;
}

function loadNapiCanvas(): NapiCanvasModule {
  const canvasModule = getRequire()("@napi-rs/canvas") as NapiCanvasModule;
  const globalRecord = globalThis as Record<string, unknown>;

  globalRecord.DOMMatrix ??= canvasModule.DOMMatrix;
  globalRecord.DOMPoint ??= canvasModule.DOMPoint;
  globalRecord.ImageData ??= canvasModule.ImageData;
  globalRecord.Path2D ??= canvasModule.Path2D;

  return canvasModule;
}

function normalizeImageFormat(
  format: KnexReadServerTileFormat | undefined,
): "png" | "webp" | "jpeg" {
  if (format === "png" || format === "jpeg" || format === "webp") {
    return format;
  }

  const configured =
    process.env.KNEXREAD_TILE_RENDERER_DEFAULT_FORMAT?.trim().toLowerCase();

  if (configured === "png" || configured === "jpeg" || configured === "webp") {
    return configured;
  }

  return "webp";
}

function normalizeQuality(quality: number | undefined): number {
  const configured = Number(process.env.KNEXREAD_TILE_RENDERER_WEBP_QUALITY);
  const value = Number.isFinite(quality)
    ? quality
    : Number.isFinite(configured)
      ? configured
      : 92;

  return Math.max(1, Math.min(100, Math.round(value ?? 92)));
}

function createCacheKey(input: KnexReadServerTileRequest) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        documentId: input.documentId,
        pdfFileId: input.pdfFileId,
        pageNumber: input.pageNumber,
        zoom: input.zoom,
        outputScale: input.outputScale,
        dpi: input.dpi,
        tile: input.tile,
        page: input.page,
        renderPhase: input.renderPhase,
        format: input.format,
        quality: input.quality,
      }),
    )
    .digest("hex");
}

function createTileId(input: KnexReadServerTileRequest) {
  const zoomBucket = Math.round(input.zoom * 100);
  const scaleBucket = Math.round(input.outputScale * 100);

  return `p${input.pageNumber}_z${zoomBucket}_r${input.tile.row}_c${input.tile.column}_s${scaleBucket}`;
}

function buildSourceUrl(request: KnexReadServerTileRequest): string | null {
  if (request.pdfUrl?.trim()) {
    return request.pdfUrl.trim();
  }

  const template = process.env.KNEXREAD_TILE_SOURCE_BASE_URL?.trim();
  if (!template || !request.pdfFileId) return null;

  if (template.includes("{pdfFileId}")) {
    return template
      .replaceAll("{projectId}", encodeURIComponent(request.projectId ?? ""))
      .replaceAll("{documentId}", encodeURIComponent(request.documentId))
      .replaceAll("{pdfFileId}", encodeURIComponent(request.pdfFileId));
  }

  const base = template.replace(/\/+$/, "");

  return `${base}/${encodeURIComponent(request.pdfFileId)}.pdf`;
}

function normalizeLocalSourceId(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getLocalPdfSourcePath(pdfFileId: string): string {
  const sourceRoot =
    process.env.KNEXREAD_TILE_SOURCE_LOCAL_DIR?.trim() ||
    join(process.cwd(), ".cache", "knexread", "pdf-sources");

  return join(sourceRoot, `${normalizeLocalSourceId(pdfFileId)}.pdf`);
}

async function loadPdfBytes(request: KnexReadServerTileRequest) {
  if (request.pdfBytesBase64?.trim()) {
    return Uint8Array.from(Buffer.from(request.pdfBytesBase64.trim(), "base64"));
  }

  if (request.pdfFileId) {
    try {
      return new Uint8Array(await readFile(getLocalPdfSourcePath(request.pdfFileId)));
    } catch {
      // Fall through to configured remote source, when present.
    }
  }

  const sourceUrl = buildSourceUrl(request);
  if (!sourceUrl) {
    throw new Error("server-pdf-source-storage-not-configured");
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`server-pdf-source-fetch-failed-${response.status}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

function getRenderTimeoutMs() {
  const configured = Number(process.env.KNEXREAD_TILE_RENDER_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 8000;
}

function withTimeout<T>(input: {
  promise: Promise<T>;
  timeoutMs: number;
  onTimeout?: () => void;
}): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      input.onTimeout?.();
      reject(new Error("server-tile-render-timeout"));
    }, input.timeoutMs);
  });

  return Promise.race([input.promise, timeout]).finally(() => {
    if (timer !== null) {
      clearTimeout(timer);
    }
  });
}

async function renderPdfJsNativeTile(
  request: KnexReadServerTileRequest,
): Promise<KnexReadServerTileResponse> {
  const startedAt = Date.now();
  const canvasModule = loadNapiCanvas();
  const pdfjs = await importPdfJsModule();
  const pdfBytes = await loadPdfBytes(request);
  const outputScale = Math.max(1, request.outputScale);
  const width = Math.max(1, Math.ceil(request.tile.cssWidth * outputScale));
  const height = Math.max(1, Math.ceil(request.tile.cssHeight * outputScale));
  const canvas = canvasModule.createCanvas(width, height);
  const context = canvas.getContext("2d");
  const format = normalizeImageFormat(request.format);
  const quality = normalizeQuality(request.quality);
  const loadingTask = pdfjs.getDocument({
    data: pdfBytes,
    disableWorker: true,
    useSystemFonts: true,
  });
  const timeoutMs = getRenderTimeoutMs();
  let renderTask: PdfJsRenderTask | null = null;
  let document: PdfJsDocument | null = null;

  try {
    document = await withTimeout({
      promise: loadingTask.promise,
      timeoutMs,
    });
    const page = await document.getPage(request.pageNumber);
    const viewport = page.getViewport({
      scale: request.zoom,
      rotation: request.page.rotation,
    });

    const contextRecord = context as {
      save: () => void;
      restore: () => void;
      fillStyle: string;
      fillRect: (x: number, y: number, width: number, height: number) => void;
    };

    contextRecord.save();
    contextRecord.fillStyle = "#ffffff";
    contextRecord.fillRect(0, 0, width, height);
    contextRecord.restore();

    renderTask = page.render({
      canvasContext: context,
      viewport,
      transform: [
        outputScale,
        0,
        0,
        outputScale,
        -request.tile.cssLeft * outputScale,
        -request.tile.cssTop * outputScale,
      ],
      intent: "display",
    });

    await withTimeout({
      promise: renderTask.promise,
      timeoutMs,
      onTimeout: () => {
        try {
          renderTask?.cancel?.();
        } catch {
          // Best effort cancellation for pdf.js render tasks.
        }
      },
    });

    const imageBytes = canvas.encodeSync(format, quality);
    const mimeType = format === "jpeg" ? "image/jpeg" : `image/${format}`;
    const cacheKey = createCacheKey(request);

    return {
      ok: true,
      tileId: createTileId(request),
      cacheKey,
      status: "ready",
      imageUrl: `data:${mimeType};base64,${imageBytes.toString("base64")}`,
      width,
      height,
      cssLeft: request.tile.cssLeft,
      cssTop: request.tile.cssTop,
      cssWidth: request.tile.cssWidth,
      cssHeight: request.tile.cssHeight,
      outputScale,
      dpi: request.dpi,
      renderDurationMs: Date.now() - startedAt,
      fromCache: false,
      backend: "pdfjs-node-native-canvas",
      storageHit: false,
    };
  } finally {
    await document?.destroy?.();
  }
}

export async function renderNativeServerTile(
  request: KnexReadServerTileRequest,
): Promise<NativeServerTileRenderResult> {
  const engine = getConfiguredRendererEngine();

  if (!request.pdfFileId && !request.pdfUrl && !request.pdfBytesBase64) {
    return createFallbackResponse({
      reason: "pdf-source-required-for-native-renderer",
      status: 422,
    });
  }

  if (!isNativeTileEncoderEnabled()) {
    return createFallbackResponse({
      reason: "native-tile-encoder-not-enabled",
      status: 501,
    });
  }

  try {
    return {
      status: 200,
      response: await renderPdfJsNativeTile(request),
    };
  } catch (error) {
    return createFallbackResponse({
      reason:
        error instanceof Error
          ? `${engine}-server-tile-render-failed:${error.message}`
          : `${engine}-server-tile-render-failed`,
      retryable: true,
      status: 502,
    });
  }
}
