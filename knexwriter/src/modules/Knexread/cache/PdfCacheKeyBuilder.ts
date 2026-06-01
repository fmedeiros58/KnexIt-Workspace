import type { KnexPdfRenderMode } from "../core/KnexPdfTypes";

export type KnexPdfCacheBackend =
  | "pdfium"
  | "pdfjs"
  | "server"
  | "native-server"
  | "unknown"
  | string;

export type KnexPdfCacheTextLayerMode =
  | "none"
  | "semantic"
  | "hybrid"
  | "nativeVisual"
  | "visual";

export type KnexPdfCacheKeyExtraValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export interface KnexPdfCacheKeyInput {
  namespace: string;
  documentId: string;
  pageIndex?: number;
  pageNumber?: number;
  backend?: KnexPdfCacheBackend;
  zoom?: number;
  rotation?: number;
  devicePixelRatio?: number;
  outputScale?: number;
  renderMode?: KnexPdfRenderMode | string;
  textLayerMode?: KnexPdfCacheTextLayerMode | string;
  ocrLanguage?: string;
  ocrConfigHash?: string;
  extra?: Record<string, KnexPdfCacheKeyExtraValue>;
}

function normalizePart(value: KnexPdfCacheKeyExtraValue): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(Math.round(value * 1000) / 1000) : "-";
  }

  return String(value).replace(/[|=]/g, "_");
}

function appendPart(parts: string[], name: string, value: KnexPdfCacheKeyExtraValue) {
  parts.push(`${name}=${normalizePart(value)}`);
}

export function buildKnexPdfCacheKey(input: KnexPdfCacheKeyInput): string {
  const parts: string[] = [normalizePart(input.namespace)];
  const page = input.pageIndex ?? input.pageNumber;

  appendPart(parts, "doc", input.documentId);
  appendPart(parts, "page", page);
  appendPart(parts, "backend", input.backend ?? "unknown");
  appendPart(parts, "zoom", input.zoom);
  appendPart(parts, "rot", input.rotation);
  appendPart(parts, "dpr", input.devicePixelRatio);
  appendPart(parts, "out", input.outputScale);
  appendPart(parts, "mode", input.renderMode);
  appendPart(parts, "text", input.textLayerMode);
  appendPart(parts, "ocrLang", input.ocrLanguage);
  appendPart(parts, "ocrCfg", input.ocrConfigHash);

  const extra = input.extra ?? {};
  for (const key of Object.keys(extra).sort()) {
    appendPart(parts, key, extra[key]);
  }

  return parts.join("|");
}

export class PdfCacheKeyBuilder {
  static pageRender(input: Omit<KnexPdfCacheKeyInput, "namespace">): string {
    return buildKnexPdfCacheKey({ ...input, namespace: "page-render" });
  }

  static textModel(input: Omit<KnexPdfCacheKeyInput, "namespace">): string {
    return buildKnexPdfCacheKey({ ...input, namespace: "text-model" });
  }

  static annotation(input: Omit<KnexPdfCacheKeyInput, "namespace">): string {
    return buildKnexPdfCacheKey({ ...input, namespace: "annotation" });
  }

  static ocr(input: Omit<KnexPdfCacheKeyInput, "namespace">): string {
    return buildKnexPdfCacheKey({ ...input, namespace: "ocr" });
  }
}
