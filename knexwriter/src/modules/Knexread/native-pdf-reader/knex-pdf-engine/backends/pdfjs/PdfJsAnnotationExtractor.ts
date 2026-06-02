import type { PdfBackendAnnotation, PdfBackendPageHandle } from "../PdfRenderBackend";

export class PdfJsAnnotationExtractor {
  async extract(page: PdfBackendPageHandle, scale: number): Promise<PdfBackendAnnotation[]> {
    const backendPage = page.backendPage as {
      getViewport: (params: { scale: number }) => {
        transform?: number[];
        convertToViewportRectangle?: (rect: number[]) => number[];
      };
      getAnnotations?: (params?: { intent?: "display" | "print" }) => Promise<
        Array<{
          subtype?: string;
        rect?: number[];
        url?: string;
        unsafeUrl?: string;
        dest?: unknown;
      }>
      >;
    };
    const viewport = backendPage.getViewport({ scale });
    const annotations = (await backendPage.getAnnotations?.({ intent: "display" })) ?? [];
    const viewportMatrix = normalizePdfMatrix(viewport.transform);

    return annotations
      .map((annotation, index): PdfBackendAnnotation | null => {
        if (annotation.subtype !== "Link" || !Array.isArray(annotation.rect)) return null;
        const viewportRect =
          typeof viewport.convertToViewportRectangle === "function"
            ? viewport.convertToViewportRectangle(annotation.rect)
            : [
                ...transformPdfPoint(
                  viewportMatrix,
                  Number(annotation.rect[0]) || 0,
                  Number(annotation.rect[1]) || 0,
                ),
                ...transformPdfPoint(
                  viewportMatrix,
                  Number(annotation.rect[2]) || 0,
                  Number(annotation.rect[3]) || 0,
                ),
              ];
        const x = Math.min(viewportRect[0], viewportRect[2]);
        const y = Math.min(viewportRect[1], viewportRect[3]);
        const width = Math.abs(viewportRect[2] - viewportRect[0]);
        const height = Math.abs(viewportRect[3] - viewportRect[1]);
        if (width <= 0 || height <= 0) return null;

        return {
          id: `p${page.pageNumber}-link-${index + 1}`,
          pageNumber: page.pageNumber,
          x,
          y,
          width,
          height,
          url: annotation.url ?? annotation.unsafeUrl,
          dest: annotation.dest,
        };
      })
      .filter(Boolean) as PdfBackendAnnotation[];
  }
}

type PdfMatrix = [number, number, number, number, number, number];

function normalizePdfMatrix(input: unknown): PdfMatrix {
  if (!Array.isArray(input) || input.length < 6) return [1, 0, 0, 1, 0, 0];
  return [
    Number(input[0]) || 0,
    Number(input[1]) || 0,
    Number(input[2]) || 0,
    Number(input[3]) || 0,
    Number(input[4]) || 0,
    Number(input[5]) || 0,
  ];
}

function transformPdfPoint(matrix: PdfMatrix, x: number, y: number) {
  return [
    matrix[0] * x + matrix[2] * y + matrix[4],
    matrix[1] * x + matrix[3] * y + matrix[5],
  ] as const;
}
