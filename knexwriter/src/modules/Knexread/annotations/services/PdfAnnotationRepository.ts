import type {
  KnexPdfAnnotationDraft,
  KnexPdfAnnotationRecord,
} from "../domain";

export interface PdfAnnotationQuery {
  documentId: string;
  pageIndex?: number;
  type?: KnexPdfAnnotationRecord["type"];
}

export interface PdfAnnotationRepository {
  list(query: PdfAnnotationQuery): Promise<KnexPdfAnnotationRecord[]>;
  getById(id: string): Promise<KnexPdfAnnotationRecord | null>;
  create(draft: KnexPdfAnnotationDraft): Promise<KnexPdfAnnotationRecord>;
  update(
    id: string,
    patch: Partial<Omit<KnexPdfAnnotationRecord, "id" | "createdAt">>,
  ): Promise<KnexPdfAnnotationRecord>;
  delete(id: string): Promise<void>;
}
