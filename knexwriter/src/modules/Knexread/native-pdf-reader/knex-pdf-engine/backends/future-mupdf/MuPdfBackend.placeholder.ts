export const MUPDF_BACKEND_EXTENSION_POINT = {
  id: "future-mupdf",
  backend: "MuPDF",
  status: "reserved-extension-point",
  reason:
    "Reserved for a future desktop/PWA/mobile backend. Do not remove while KnexPDF Engine supports planned non-PDF.js renderers.",
} as const;

export type MuPdfBackendExtensionPoint = typeof MUPDF_BACKEND_EXTENSION_POINT;
