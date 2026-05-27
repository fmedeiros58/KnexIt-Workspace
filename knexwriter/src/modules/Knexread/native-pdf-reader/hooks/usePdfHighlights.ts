import { useCallback, useState } from "react";
import type { PdfHighlightRecord, PdfTextSelection } from "../types";
import {
  createPdfHighlight,
  deletePdfHighlight,
  listPdfHighlights,
  updatePdfHighlight,
} from "../services";

export function usePdfHighlights() {
  const [highlights, setHighlights] = useState<PdfHighlightRecord[]>([]);

  const loadHighlights = useCallback(async (pdfFileId: string) => {
    const loaded = await listPdfHighlights(pdfFileId);
    setHighlights(loaded);
    return loaded;
  }, []);

  const addHighlight = useCallback(
    async (input: {
      pdfFileId: string;
      projectId: string;
      documentId?: string;
      selection: PdfTextSelection;
      color?: PdfHighlightRecord["color"];
      note?: string;
    }) => {
      const record = await createPdfHighlight(input);
      setHighlights((current) => [...current, record]);
      return record;
    },
    [],
  );

  const editHighlight = useCallback(
    async (id: string, patch: Partial<PdfHighlightRecord>) => {
      const updated = await updatePdfHighlight(id, patch);
      if (!updated) return null;
      setHighlights((current) =>
        current.map((item) => (item.id === id ? updated : item)),
      );
      return updated;
    },
    [],
  );

  const removeHighlight = useCallback(async (id: string) => {
    await deletePdfHighlight(id);
    setHighlights((current) => current.filter((item) => item.id !== id));
  }, []);

  return {
    highlights,
    loadHighlights,
    addHighlight,
    editHighlight,
    removeHighlight,
  };
}

