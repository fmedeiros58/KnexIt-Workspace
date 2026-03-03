import mammoth from "mammoth";

export class UnsupportedDocumentTypeError extends Error {
  readonly mimeType: string;
  readonly extension: string;

  constructor(message: string, mimeType: string, extension: string) {
    super(message);
    this.mimeType = mimeType;
    this.extension = extension;
  }
}

export type ExtractTextInput = {
  bytes: Buffer;
  fileName: string;
  mimeType: string;
};

export type ExtractTextResult = {
  text: string;
  parser: "utf8" | "docx";
  mimeType: string;
  extension: string;
};

const MIME_BY_EXTENSION: Record<string, string> = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const SUPPORTED_MIME_TYPES = new Set<string>([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

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

  return {
    text: normalizeExtractedText(decodeUtf8(input.bytes)),
    parser: "utf8",
    mimeType,
    extension,
  };
}

