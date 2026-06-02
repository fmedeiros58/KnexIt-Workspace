import { useCallback, useState } from "react";
import type { PdfAnnotationRecord } from "../types";
import {
  createPdfAnnotation,
  deletePdfAnnotation,
  listPdfAnnotations,
  updatePdfAnnotation,
} from "../services";

export function usePdfAnnotations() {
  const [annotations, setAnnotations] = useState<PdfAnnotationRecord[]>([]);

  const loadAnnotations = useCallback(async (pdfFileId: string) => {
    const loaded = await listPdfAnnotations(pdfFileId);
    setAnnotations(loaded);
    return loaded;
  }, []);

  const addAnnotation = useCallback(
    async (input: {
      pdfFileId: string;
      projectId: string;
      documentId?: string;
      pageNumber: number;
      content: string;
      annotationType?: PdfAnnotationRecord["annotationType"];
      highlightId?: string;
    }) => {
      const record = await createPdfAnnotation(input);
      setAnnotations((current) => [...current, record]);
      return record;
    },
    [],
  );

  const editAnnotation = useCallback(
    async (id: string, patch: Partial<PdfAnnotationRecord>) => {
      const updated = await updatePdfAnnotation(id, patch);
      if (!updated) return null;
      setAnnotations((current) =>
        current.map((item) => (item.id === id ? updated : item)),
      );
      return updated;
    },
    [],
  );

  const removeAnnotation = useCallback(async (id: string) => {
    await deletePdfAnnotation(id);
    setAnnotations((current) => current.filter((item) => item.id !== id));
  }, []);

  return {
    annotations,
    loadAnnotations,
    addAnnotation,
    editAnnotation,
    removeAnnotation,
  };
}

