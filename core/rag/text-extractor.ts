import mammoth from "mammoth";
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
};

const MIME_BY_EXTENSION: Record<string, string> = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const SUPPORTED_MIME_TYPES = new Set<string>([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

let cachedPdfJsModule: Awaited<ReturnType<typeof importPdfJsModule>> | null = null;

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

function decodeUtf8(bytes: Buffer) {
  return bytes.toString("utf8");
}

function normalizeExtractedText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\u0000/g, "").trim();
}

async function importPdfJsModule() {
  const pdfModulePath = path.resolve(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.mjs");
  const pdfModuleUrl = pathToFileURL(pdfModulePath).toString();
  return import(/* webpackIgnore: true */ pdfModuleUrl);
}

async function loadPdfJsModule() {
  if (cachedPdfJsModule) return cachedPdfJsModule;
  cachedPdfJsModule = await importPdfJsModule();
  return cachedPdfJsModule;
}

async function extractPdfText(bytes: Buffer) {
  const pdfjs = await loadPdfJsModule();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    useSystemFonts: false,
    verbosity: 0,
  });

  const document = await loadingTask.promise;
  try {
    const pages: string[] = [];
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
      pages.push(lines);
      page.cleanup();
    }
    return normalizeExtractedText(pages.join("\n\n"));
  } finally {
    await document.destroy();
  }
}

export function listSupportedDocumentTypes() {
  return Array.from(SUPPORTED_MIME_TYPES.values()).sort();
}

export async function extractTextFromDocument(input: ExtractTextInput): Promise<ExtractTextResult> {
  const extension = resolveExtension(input.fileName);
  const mimeType = normalizeMimeType(input.mimeType, extension);

  if (!mimeType || !SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw new UnsupportedDocumentTypeError(
      `Formato nao suportado nesta versao (mime='${mimeType || "desconhecido"}', ext='${extension || "sem-ext"}').`,
      mimeType,
      extension,
    );
  }

  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const extracted = await mammoth.extractRawText({ buffer: input.bytes });
    return {
      text: normalizeExtractedText(extracted.value || ""),
      parser: "docx",
      mimeType,
      extension,
    };
  }

  if (mimeType === "application/pdf") {
    try {
      return {
        text: await extractPdfText(input.bytes),
        parser: "pdf",
        mimeType,
        extension,
      };
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

  return {
    text: normalizeExtractedText(decodeUtf8(input.bytes)),
    parser: "utf8",
    mimeType,
    extension,
  };
}
