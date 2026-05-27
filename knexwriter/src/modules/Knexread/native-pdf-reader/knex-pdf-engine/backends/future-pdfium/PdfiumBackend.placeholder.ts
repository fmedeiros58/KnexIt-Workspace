export const PDFIUM_BACKEND_EXTENSION_POINT = {
  id: "future-pdfium",
  backend: "PDFium",
  status: "reserved-extension-point",
  reason:
    "Reserved for a future desktop/PWA/mobile backend. Do not remove while KnexPDF Engine supports planned non-PDF.js renderers.",
} as const;

export type PdfiumBackendExtensionPoint = typeof PDFIUM_BACKEND_EXTENSION_POINT;
