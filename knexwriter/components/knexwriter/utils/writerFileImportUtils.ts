import { normalizeTextToEditableHtml } from "./writerHtmlUtils";

export async function convertPdfToEditableHtml(file: File) {
  const text = await file.text();
  return {
    html: normalizeTextToEditableHtml(text),
    warning: "Conversão PDF em modo simplificado."
  };
}

export async function convertDocxToEditableHtml(file: File) {
  const text = await file.text();
  return {
    html: normalizeTextToEditableHtml(text),
    warning: "Conversão DOCX em modo simplificado."
  };
}

export async function convertImportedFileToEditableHtml(file: File) {
  const text = await file.text();
  return {
    html: normalizeTextToEditableHtml(text),
    conversionMode: "plain-text" as const,
    warning: null,
  };
}

export function loadPdfJsGlobal() {
  return null;
}

export function loadDocxPreviewGlobal() {
  return null;
}

export function loadMammothGlobal() {
  return null;
}

export function extractDocxPreviewEditableHtml(renderedHtml: string) {
  return renderedHtml;
}

export function convertPdfItemsToPageText(items: Array<{ str?: string }>) {
  return items.map((item) => item.str || "").join(" ").trim();
}

export function getBaseFileName(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex < 0) return fileName.trim() || "Documento importado";
  return fileName.slice(0, dotIndex).trim() || "Documento importado";
}

export function getFileExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");
  if (dotIndex < 0) return "";
  return normalized.slice(dotIndex + 1);
}

