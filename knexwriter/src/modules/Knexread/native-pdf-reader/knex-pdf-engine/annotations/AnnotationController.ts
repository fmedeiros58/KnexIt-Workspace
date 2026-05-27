export type KnexPdfAnnotationKind = "highlight" | "comment" | "citation";

export type KnexPdfAnnotationModel = {
  id: string;
  pageNumber: number;
  kind: KnexPdfAnnotationKind;
  rects: Array<{ x: number; y: number; width: number; height: number }>;
  note?: string;
  color?: string;
};

export class AnnotationController {
  private annotations: KnexPdfAnnotationModel[] = [];

  list(pageNumber?: number) {
    return pageNumber === undefined
      ? [...this.annotations]
      : this.annotations.filter((annotation) => annotation.pageNumber === pageNumber);
  }

  upsert(annotation: KnexPdfAnnotationModel) {
    this.annotations = [
      ...this.annotations.filter((item) => item.id !== annotation.id),
      annotation,
    ];
  }

  remove(id: string) {
    this.annotations = this.annotations.filter((annotation) => annotation.id !== id);
  }
}
