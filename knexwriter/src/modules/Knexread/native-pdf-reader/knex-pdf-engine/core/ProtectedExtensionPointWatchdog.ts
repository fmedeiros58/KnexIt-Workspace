import { MUPDF_BACKEND_EXTENSION_POINT } from "../backends/future-mupdf/MuPdfBackend.placeholder";
import { PDFIUM_BACKEND_EXTENSION_POINT } from "../backends/future-pdfium/PdfiumBackend.placeholder";
import { TRANSLATION_RECONSTRUCTION_ENGINE_EXTENSION_POINT } from "../translation/TranslationReconstructionEngine.placeholder";

export const KNEX_PDF_PROTECTED_EXTENSION_POINTS = [
  MUPDF_BACKEND_EXTENSION_POINT,
  PDFIUM_BACKEND_EXTENSION_POINT,
  TRANSLATION_RECONSTRUCTION_ENGINE_EXTENSION_POINT,
] as const;

export type KnexPdfProtectedExtensionPoint =
  (typeof KNEX_PDF_PROTECTED_EXTENSION_POINTS)[number];

export function assertKnexPdfProtectedExtensionPoints() {
  return KNEX_PDF_PROTECTED_EXTENSION_POINTS;
}
