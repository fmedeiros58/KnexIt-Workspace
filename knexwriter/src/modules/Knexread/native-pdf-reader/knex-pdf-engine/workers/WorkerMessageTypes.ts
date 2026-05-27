export type PdfRenderWorkerRequest =
  | { type: "render-page"; pageNumber: number; renderVersion: number }
  | { type: "cancel-render"; renderVersion: number };

export type PdfRenderWorkerResponse =
  | { type: "render-complete"; pageNumber: number; renderVersion: number }
  | { type: "render-error"; pageNumber: number; renderVersion: number; message: string };
