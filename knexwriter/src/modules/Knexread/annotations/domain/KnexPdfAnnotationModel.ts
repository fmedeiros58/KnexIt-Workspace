import type {
  KnexPdfAnnotationDraft,
  KnexPdfAnnotationRecord,
} from "./KnexPdfAnnotationTypes";

export interface KnexPdfAnnotationIdFactory {
  createId(): string;
}

const defaultIdFactory: KnexPdfAnnotationIdFactory = {
  createId() {
    return `pdf-annotation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  },
};

export function createKnexPdfAnnotationRecord(
  draft: KnexPdfAnnotationDraft,
  options: { idFactory?: KnexPdfAnnotationIdFactory; now?: string } = {},
): KnexPdfAnnotationRecord {
  const now = options.now ?? new Date().toISOString();
  const idFactory = options.idFactory ?? defaultIdFactory;

  return {
    ...draft,
    id: idFactory.createId(),
    createdAt: now,
    updatedAt: now,
  } as KnexPdfAnnotationRecord;
}
