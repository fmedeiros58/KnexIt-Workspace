import mammoth from "mammoth";
import { existsSync } from "fs";
import path from "path";
import { pathToFileURL } from "url";

export class UnsupportedDocumentTypeError extends Error {
  readonly mimeType: string;
  readonly extension: string;

  constructor(message: string, mimeType: string, extension: string) {
    super(message);
    this.mimeType = mimeType;
    this.extension = extension;
  }
}

export class DocumentTextExtractionError extends Error {
  readonly mimeType: string;
  readonly extension: string;
  readonly causeMessage: string;

  constructor(message: string, mimeType: string, extension: string, causeMessage: string) {
    super(message);
    this.mimeType = mimeType;
    this.extension = extension;
    this.causeMessage = causeMessage;
  }
}

export type ExtractTextInput = {
  bytes: Buffer;
  fileName: string;
  mimeType: string;
};

export type ExtractTextResult = {
  text: string;
  parser: "utf8" | "docx" | "pdf";
  mimeType: string;
  extension: string;
  ocrApplied?: boolean;
  ocrPageCount?: number;
  textQuality?: "native" | "ocr_fallback" | "placeholder";
};

type PdfJsModule = {
  getDocument: (params: Record<string, unknown>) => {
    promise: Promise<{
      numPages: number;
      getPage: (pageNumber: number) => Promise<{
        getTextContent: () => Promise<{ items: unknown[] }>;
        getViewport: (params: { scale: number }) => { width: number; height: number };
        render: (params: Record<string, unknown>) => { promise: Promise<void> };
        cleanup: () => void;
      }>;
      destroy: () => Promise<void>;
    }>;
  };
};

type CanvasModule = {
  createCanvas: (
    width: number,
    height: number,
  ) => {
    getContext: (kind: "2d") => unknown;
    toBuffer: (mimeType?: string) => Buffer;
  };
};

type OcrWorker = {
  recognize: (input: Buffer | Uint8Array | string) => Promise<{ data?: { text?: string } }>;
  terminate: () => Promise<void>;
};

type TesseractWorkerOptions = {
  langPath?: string;
  cachePath?: string;
  logger?: (payload: unknown) => void;
  errorHandler?: (error: unknown) => void;
};

type TesseractModule = {
  createWorker: (language?: string | string[], oem?: unknown, options?: TesseractWorkerOptions) => Promise<OcrWorker>;
};

type OcrConfig = {
  enabled: boolean;
  language: string;
  timeoutMs: number;
  workerInitTimeoutMs: number;
  workerTerminateTimeoutMs: number;
  minCharsPerPage: number;
  pdfMaxPages: number;
  pdfScale: number;
  langPath?: string;
  cachePath?: string;
};

const MIME_BY_EXTENSION: Record<string, string> = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".csv": "text/csv",
  ".tsv": "text/tab-separated-values",
  ".xml": "application/xml",
  ".html": "text/html",
  ".htm": "text/html",
  ".yaml": "application/yaml",
  ".yml": "application/yaml",
  ".rtf": "application/rtf",
  ".log": "text/plain",
  ".ini": "text/plain",
  ".cfg": "text/plain",
  ".sql": "text/plain",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

const SUPPORTED_MIME_TYPES = new Set<string>([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/tab-separated-values",
  "text/html",
  "application/json",
  "application/xml",
  "text/xml",
  "application/yaml",
  "text/yaml",
  "application/rtf",
  "text/rtf",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
]);

const UTF8_FALLBACK_EXTENSIONS = new Set<string>([
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".tsv",
  ".json",
  ".xml",
  ".yml",
  ".yaml",
  ".ini",
  ".cfg",
  ".log",
  ".html",
  ".htm",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".java",
  ".go",
  ".rs",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".rb",
  ".php",
  ".sql",
  ".sh",
  ".bat",
  ".ps1",
]);

let cachedPdfJsModule: PdfJsModule | null = null;
let cachedCanvasModule: CanvasModule | null = null;
let cachedTesseractModule: TesseractModule | null = null;

function parseBooleanFlag(value: string | undefined, fallback: boolean) {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parsePositiveInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function parseFiniteNumber(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeOptionalPath(value: string | undefined) {
  const candidate = `${value || ""}`.trim();
  if (!candidate) return "";
  return path.isAbsolute(candidate) ? path.resolve(candidate) : path.resolve(process.cwd(), candidate);
}

function splitOcrLanguages(language: string) {
  const parsed = `${language || ""}`
    .split("+")
    .map((row) => row.trim())
    .filter(Boolean);
  return parsed.length ? parsed : ["por"];
}

function hasAllLanguageFiles(basePath: string, languages: string[]) {
  if (!basePath || !languages.length) return false;
  return languages.every((language) => {
    const trainedData = path.join(basePath, `${language}.traineddata`);
    const trainedDataGz = path.join(basePath, `${language}.traineddata.gz`);
    return existsSync(trainedData) || existsSync(trainedDataGz);
  });
}

function resolveLocalOcrLanguagePath(language: string, raw: NodeJS.ProcessEnv = process.env) {
  const explicit = normalizeOptionalPath(raw.OCR_LANG_PATH || raw.OCR_TESSDATA_PATH);
  const candidates = Array.from(
    new Set(
      [
        explicit,
        path.resolve(process.cwd(), "tessdata"),
        path.resolve(process.cwd(), "data", "tessdata"),
        process.cwd(),
        path.resolve(process.cwd(), "..", "tessdata"),
        path.resolve(process.cwd(), ".."),
      ].filter(Boolean),
    ),
  );
  const languages = splitOcrLanguages(language);
  for (const candidate of candidates) {
    if (hasAllLanguageFiles(candidate, languages)) return candidate;
  }
  return undefined;
}

function resolveOcrCachePath(raw: NodeJS.ProcessEnv = process.env, fallbackPath?: string) {
  const explicit = normalizeOptionalPath(raw.OCR_CACHE_PATH);
  if (explicit) return explicit;
  if (fallbackPath) return fallbackPath;
  return undefined;
}

function resolveOcrConfig(raw: NodeJS.ProcessEnv = process.env): OcrConfig {
  const language = `${raw.OCR_LANG || "por"}`.trim() || "por";
  const langPath = resolveLocalOcrLanguagePath(language, raw);
  return {
    enabled: parseBooleanFlag(raw.OCR_AUTO_ENABLED, true),
    language,
    timeoutMs: parsePositiveInt(raw.OCR_TIMEOUT_MS, 25_000, 2_000, 240_000),
    workerInitTimeoutMs: parsePositiveInt(raw.OCR_WORKER_INIT_TIMEOUT_MS, 15_000, 1_000, 240_000),
    workerTerminateTimeoutMs: parsePositiveInt(raw.OCR_WORKER_TERMINATE_TIMEOUT_MS, 2_000, 250, 30_000),
    minCharsPerPage: parsePositiveInt(raw.OCR_MIN_CHARS_PER_PAGE, 64, 0, 2_000),
    pdfMaxPages: parsePositiveInt(raw.OCR_PDF_MAX_PAGES, 6, 1, 80),
    pdfScale: parseFiniteNumber(raw.OCR_PDF_SCALE, 2, 1, 4),
    langPath,
    cachePath: resolveOcrCachePath(raw, langPath),
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutLabel: string) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(timeoutLabel)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function resolveExtension(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return "";
  return fileName.slice(dot).toLowerCase();
}

function normalizeMimeType(mimeType: string, extension: string) {
  const normalizedMime = mimeType.trim().toLowerCase();
  if (normalizedMime) return normalizedMime;
  return MIME_BY_EXTENSION[extension] || "";
}

function inferMimeTypeFromSignature(bytes: Buffer) {
  if (!bytes?.length) return "";
  if (bytes.length >= 5 && bytes.slice(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 6) {
    const head = bytes.slice(0, 6).toString("ascii");
    if (head === "GIF87a" || head === "GIF89a") return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes.slice(0, 4).toString("ascii") === "RIFF" &&
    bytes.slice(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
  if (bytes.length >= 4) {
    const isLittleTiff = bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00;
    const isBigTiff = bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a;
    if (isLittleTiff || isBigTiff) return "image/tiff";
  }
  return "";
}

function inferMimeType(input: ExtractTextInput, extension: string) {
  const normalized = normalizeMimeType(input.mimeType, extension);
  if (normalized) return normalized;
  const bySignature = inferMimeTypeFromSignature(input.bytes);
  if (bySignature) return bySignature;
  return "";
}

function decodeUtf8(bytes: Buffer) {
  return bytes.toString("utf8");
}

function decodeLatin1(bytes: Buffer) {
  return bytes.toString("latin1");
}

function countMojibakeArtifacts(value: string) {
  return (value.match(/(?:Ãƒ.|Ã‚.|Ã¢[â‚¬â„¢â€œâ€â€“â€”])/g) || []).length;
}

function countPortugueseAccents(value: string) {
  return (value.match(/[Ã¡Ã©Ã­Ã³ÃºÃ Ã¢Ã£ÃªÃ´ÃµÃ§ÃÃ‰ÃÃ“ÃšÃ€Ã‚ÃƒÃŠÃ”Ã•Ã‡]/g) || []).length;
}

function decodeLikelyMojibake(value: string) {
  const text = `${value || ""}`;
  if (!text.trim()) return "";
  if (countMojibakeArtifacts(text) === 0) return text;
  try {
    const bytes = Uint8Array.from(Array.from(text).map((char) => char.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (!decoded.trim()) return text;
    const before = countMojibakeArtifacts(text);
    const after = countMojibakeArtifacts(decoded);
    const accentGain = countPortugueseAccents(decoded) - countPortugueseAccents(text);
    if (after < before || accentGain > 0) return decoded;
    return text;
  } catch {
    return text;
  }
}

function normalizeExtractedText(text: string) {
  const decoded = decodeLikelyMojibake(`${text || ""}`);
  return decoded.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\u0000/g, "").trim();
}

function visibleCharCount(value: string) {
  return `${value || ""}`.replace(/\s+/g, "").length;
}

function isLikelyTextBuffer(bytes: Buffer) {
  if (!bytes?.length) return true;
  const sampleSize = Math.min(bytes.length, 16_384);
  let printable = 0;
  let nulls = 0;
  for (let index = 0; index < sampleSize; index += 1) {
    const value = bytes[index];
    if (value === 0x00) {
      nulls += 1;
      continue;
    }
    if ((value >= 0x20 && value <= 0x7e) || value === 0x09 || value === 0x0a || value === 0x0d) {
      printable += 1;
    }
  }
  const printableRatio = printable / sampleSize;
  const nullRatio = nulls / sampleSize;
  return nullRatio < 0.03 && printableRatio > 0.6;
}

function scoreDecodedText(value: string) {
  const text = `${value || ""}`;
  if (!text) return 0;
  const visible = visibleCharCount(text);
  const mojibakePenalty = countMojibakeArtifacts(text) * 3;
  const replacementPenalty = (text.match(/\uFFFD/g) || []).length * 2;
  const controlPenalty = (text.match(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g) || []).length * 2;
  const accentBonus = countPortugueseAccents(text);
  return visible + accentBonus - mojibakePenalty - replacementPenalty - controlPenalty;
}

function decodeLikelyText(bytes: Buffer) {
  const utf8 = decodeUtf8(bytes);
  const latin1 = decodeLikelyMojibake(decodeLatin1(bytes));
  return scoreDecodedText(latin1) > scoreDecodedText(utf8) ? latin1 : utf8;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function stripHtmlToText(value: string) {
  const normalized = `${value || ""}`
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr|td|section|article|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return normalizeExtractedText(decodeHtmlEntities(normalized));
}

function stripRtfToText(value: string) {
  const normalized = `${value || ""}`
    .replace(/\\par[d]?/gi, "\n")
    .replace(/\\tab/gi, "\t")
    .replace(/\\'([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\u(-?\d+)\??/gi, (_, code: string) => {
      const parsed = Number.parseInt(code, 10);
      if (!Number.isFinite(parsed)) return "";
      return String.fromCharCode(parsed < 0 ? parsed + 65_536 : parsed);
    })
    .replace(/\\[a-z]+-?\d*\s?/gi, " ")
    .replace(/[{}]/g, " ");
  return normalizeExtractedText(normalized);
}

function normalizeStructuredTextByType(text: string, mimeType: string, extension: string) {
  const mime = `${mimeType || ""}`.toLowerCase();
  if (mime === "text/html" || extension === ".html" || extension === ".htm") {
    return stripHtmlToText(text);
  }
  if (mime === "application/rtf" || mime === "text/rtf" || extension === ".rtf") {
    return stripRtfToText(text);
  }
  return normalizeExtractedText(text);
}

function shouldFallbackToUtf8Decode(mimeType: string, extension: string) {
  const normalizedMime = (mimeType || "").toLowerCase();
  if (!normalizedMime || normalizedMime === "application/octet-stream" || normalizedMime === "binary/octet-stream") {
    return UTF8_FALLBACK_EXTENSIONS.has(extension);
  }
  if (normalizedMime.startsWith("text/")) return true;
  if (
    normalizedMime.includes("json") ||
    normalizedMime.includes("xml") ||
    normalizedMime.includes("yaml") ||
    normalizedMime.includes("rtf") ||
    normalizedMime.includes("csv") ||
    normalizedMime.includes("tsv") ||
    normalizedMime.includes("javascript") ||
    normalizedMime.includes("typescript") ||
    normalizedMime.includes("sql")
  ) {
    return true;
  }
  return UTF8_FALLBACK_EXTENSIONS.has(extension);
}

function isImageMimeType(mimeType: string) {
  const normalized = `${mimeType || ""}`.toLowerCase();
  return (
    normalized === "image/png" ||
    normalized === "image/jpeg" ||
    normalized === "image/webp" ||
    normalized === "image/gif" ||
    normalized === "image/bmp" ||
    normalized === "image/tiff"
  );
}

function buildOpaqueFilePlaceholder(fileName: string, mimeType: string, extension: string) {
  const safeName = fileName.trim() || "arquivo";
  const safeMime = mimeType || "desconhecido";
  const safeExtension = extension || "sem-extensao";
  return [
    `Arquivo anexado: ${safeName}.`,
    `Tipo MIME: ${safeMime}.`,
    `Extensao: ${safeExtension}.`,
    "Formato sem extracao textual nativa nesta etapa.",
    "Use o anexo como referencia e, se necessario, converta para PDF, DOCX, TXT ou MD para analise completa.",
  ].join("\n");
}

async function importPdfJsModule() {
  const pdfModulePath = path.resolve(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.mjs");
  const pdfModuleUrl = pathToFileURL(pdfModulePath).toString();
  return (await import(/* webpackIgnore: true */ pdfModuleUrl)) as PdfJsModule;
}

async function loadPdfJsModule() {
  if (cachedPdfJsModule) return cachedPdfJsModule;
  cachedPdfJsModule = await importPdfJsModule();
  return cachedPdfJsModule;
}

async function loadCanvasModule() {
  if (cachedCanvasModule) return cachedCanvasModule;
  const canvasModulePath = path.resolve(process.cwd(), "node_modules/@napi-rs/canvas/index.js");
  const canvasModuleUrl = pathToFileURL(canvasModulePath).toString();
  cachedCanvasModule = (await import(/* webpackIgnore: true */ canvasModuleUrl)) as unknown as CanvasModule;
  return cachedCanvasModule;
}

async function loadTesseractModule() {
  if (cachedTesseractModule) return cachedTesseractModule;
  const tesseractModulePath = path.resolve(process.cwd(), "node_modules/tesseract.js/src/index.js");
  const tesseractModuleUrl = pathToFileURL(tesseractModulePath).toString();
  cachedTesseractModule = (await import(/* webpackIgnore: true */ tesseractModuleUrl)) as unknown as TesseractModule;
  return cachedTesseractModule;
}

async function createOcrWorker(config: OcrConfig): Promise<OcrWorker> {
  const tesseract = await loadTesseractModule();
  const options: TesseractWorkerOptions = {};
  if (config.langPath) options.langPath = config.langPath;
  if (config.cachePath) options.cachePath = config.cachePath;
  const workerPromise =
    Object.keys(options).length > 0
      ? tesseract.createWorker(config.language, undefined, options)
      : tesseract.createWorker(config.language);
  return withTimeout(
    workerPromise,
    config.workerInitTimeoutMs,
    `OCR_WORKER_INIT_TIMEOUT (${config.workerInitTimeoutMs}ms)`,
  );
}

async function terminateOcrWorker(worker: OcrWorker | null | undefined, config: OcrConfig) {
  if (!worker) return;
  try {
    await withTimeout(
      worker.terminate(),
      config.workerTerminateTimeoutMs,
      `OCR_WORKER_TERMINATE_TIMEOUT (${config.workerTerminateTimeoutMs}ms)`,
    );
  } catch {
    // Encerramento em melhor-esforco para evitar travar o pipeline.
  }
}

async function extractImageTextViaOcr(bytes: Buffer, config: OcrConfig) {
  const worker = await createOcrWorker(config);
  try {
    const recognized = await withTimeout(
      worker.recognize(bytes),
      config.timeoutMs,
      `OCR_IMAGE_TIMEOUT (${config.timeoutMs}ms)`,
    );
    return normalizeExtractedText(recognized?.data?.text || "");
  } finally {
    await terminateOcrWorker(worker, config);
  }
}

async function extractPdfNativePages(bytes: Buffer) {
  const pdfjs = await loadPdfJsModule();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  const document = await loadingTask.promise;
  try {
    const pages: Array<{ pageNumber: number; text: string }> = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const lines = textContent.items
        .map((item: unknown) => {
          if (!item || typeof item !== "object") return "";
          const candidate = item as { str?: unknown };
          return typeof candidate.str === "string" ? candidate.str : "";
        })
        .filter(Boolean)
        .join(" ");
      pages.push({ pageNumber, text: normalizeExtractedText(lines) });
      page.cleanup();
    }
    return pages;
  } finally {
    await document.destroy();
  }
}

async function extractPdfOcrPages(
  bytes: Buffer,
  pageNumbers: number[],
  config: OcrConfig,
): Promise<Map<number, string>> {
  const normalizedPageNumbers = Array.from(new Set(pageNumbers.filter((row) => row > 0)));
  const extractedByPage = new Map<number, string>();
  if (!normalizedPageNumbers.length) return extractedByPage;

  const pdfjs = await loadPdfJsModule();
  const { createCanvas } = await loadCanvasModule();
  const worker = await createOcrWorker(config);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  const document = await loadingTask.promise;

  try {
    for (const pageNumber of normalizedPageNumbers) {
      const page = await document.getPage(pageNumber);
      try {
        const viewport = page.getViewport({ scale: config.pdfScale });
        const width = Math.max(1, Math.ceil(viewport.width));
        const height = Math.max(1, Math.ceil(viewport.height));
        const canvas = createCanvas(width, height);
        const canvasContext = canvas.getContext("2d");

        await withTimeout(
          page.render({ canvasContext: canvasContext as object, viewport }).promise,
          config.timeoutMs,
          `OCR_RENDER_TIMEOUT_PAGE_${pageNumber} (${config.timeoutMs}ms)`,
        );

        const pngBytes = canvas.toBuffer("image/png");
        const recognized = await withTimeout(
          worker.recognize(pngBytes),
          config.timeoutMs,
          `OCR_PDF_TIMEOUT_PAGE_${pageNumber} (${config.timeoutMs}ms)`,
        );
        const normalized = normalizeExtractedText(recognized?.data?.text || "");
        if (normalized) {
          extractedByPage.set(pageNumber, normalized);
        }
      } finally {
        page.cleanup();
      }
    }
    return extractedByPage;
  } finally {
    await terminateOcrWorker(worker, config);
    await document.destroy().catch(() => null);
  }
}

async function extractPdfText(bytes: Buffer): Promise<ExtractTextResult> {
  const nativePages = await extractPdfNativePages(bytes);
  const mergedPages = nativePages.map((page) => ({ ...page }));
  const ocrConfig = resolveOcrConfig();
  const pagesForOcr = ocrConfig.enabled
    ? mergedPages
        .filter((row) => visibleCharCount(row.text) < ocrConfig.minCharsPerPage)
        .slice(0, ocrConfig.pdfMaxPages)
        .map((row) => row.pageNumber)
    : [];

  let ocrAppliedCount = 0;
  if (pagesForOcr.length > 0) {
    try {
      const ocrByPage = await extractPdfOcrPages(bytes, pagesForOcr, ocrConfig);
      for (const row of mergedPages) {
        const ocrText = ocrByPage.get(row.pageNumber);
        if (!ocrText) continue;
        if (visibleCharCount(ocrText) > visibleCharCount(row.text)) {
          row.text = ocrText;
          ocrAppliedCount += 1;
        }
      }
    } catch {
      // OCR e melhor-esforco: se falhar, mantemos texto nativo.
    }
  }

  const text = normalizeExtractedText(mergedPages.map((row) => row.text).join("\n\n"));
  return {
    text,
    parser: "pdf",
    mimeType: "application/pdf",
    extension: ".pdf",
    ocrApplied: ocrAppliedCount > 0,
    ocrPageCount: ocrAppliedCount,
    textQuality: ocrAppliedCount > 0 ? "ocr_fallback" : "native",
  };
}

export function listSupportedDocumentTypes() {
  return Array.from(SUPPORTED_MIME_TYPES.values()).sort();
}

export async function extractTextFromDocument(input: ExtractTextInput): Promise<ExtractTextResult> {
  const extension = resolveExtension(input.fileName);
  const mimeType = inferMimeType(input, extension);

  if (!mimeType || !SUPPORTED_MIME_TYPES.has(mimeType)) {
    if (shouldFallbackToUtf8Decode(mimeType, extension)) {
      return {
        text: normalizeStructuredTextByType(decodeLikelyText(input.bytes), mimeType, extension),
        parser: "utf8",
        mimeType: mimeType || "text/plain",
        extension,
        textQuality: "native",
      };
    }
    if (isLikelyTextBuffer(input.bytes)) {
      return {
        text: normalizeStructuredTextByType(decodeLikelyText(input.bytes), mimeType, extension),
        parser: "utf8",
        mimeType: mimeType || "text/plain",
        extension,
        textQuality: "native",
      };
    }
    return {
      text: buildOpaqueFilePlaceholder(input.fileName, mimeType, extension),
      parser: "utf8",
      mimeType: mimeType || "application/octet-stream",
      extension,
      textQuality: "placeholder",
    };
  }

  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const extracted = await mammoth.extractRawText({ buffer: input.bytes });
    return {
      text: normalizeExtractedText(extracted.value || ""),
      parser: "docx",
      mimeType,
      extension,
      textQuality: "native",
    };
  }

  if (mimeType === "application/pdf") {
    try {
      return await extractPdfText(input.bytes);
    } catch (error) {
      const causeMessage = error instanceof Error ? error.message : "erro desconhecido";
      throw new DocumentTextExtractionError(
        `Falha ao extrair texto do PDF (ext='${extension || "sem-ext"}').`,
        mimeType,
        extension,
        causeMessage,
      );
    }
  }

  if (isImageMimeType(mimeType)) {
    const ocrConfig = resolveOcrConfig();
    if (!ocrConfig.enabled) {
      return {
        text: buildOpaqueFilePlaceholder(input.fileName, mimeType, extension),
        parser: "utf8",
        mimeType,
        extension,
        textQuality: "placeholder",
      };
    }

    try {
      const text = await extractImageTextViaOcr(input.bytes, ocrConfig);
      if (!text) {
        return {
          text: buildOpaqueFilePlaceholder(input.fileName, mimeType, extension),
          parser: "utf8",
          mimeType,
          extension,
          textQuality: "placeholder",
        };
      }
      return {
        text,
        parser: "utf8",
        mimeType,
        extension,
        ocrApplied: true,
        ocrPageCount: 1,
        textQuality: "ocr_fallback",
      };
    } catch {
      return {
        text: buildOpaqueFilePlaceholder(input.fileName, mimeType, extension),
        parser: "utf8",
        mimeType,
        extension,
        textQuality: "placeholder",
      };
    }
  }

  return {
    text: normalizeStructuredTextByType(decodeLikelyText(input.bytes), mimeType, extension),
    parser: "utf8",
    mimeType,
    extension,
    textQuality: "native",
  };
}
