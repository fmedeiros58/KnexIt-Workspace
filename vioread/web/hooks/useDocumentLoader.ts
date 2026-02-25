import { useCallback, useRef, useState } from "react";
import type { DocumentDescriptor, PageMapping } from "../lib/types";
import {
  detectTextLayerAvailability,
  extractPdfPageMapping,
  loadPdfSession,
  renderPdfPageToCanvas,
  type PdfSession,
} from "../services/pdf.service";

type LoadDocumentState = {
  loading: boolean;
  error: string | null;
  document: DocumentDescriptor | null;
  hasTextLayer: boolean;
};

export function useDocumentLoader() {
  const sessionRef = useRef<PdfSession | null>(null);
  const [state, setState] = useState<LoadDocumentState>({
    loading: false,
    error: null,
    document: null,
    hasTextLayer: false,
  });

  const loadPdfFile = useCallback(async (file: File) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const session = await loadPdfSession(file);
      sessionRef.current = session;
      const firstPageMapping = await extractPdfPageMapping({ session, pageNumber: 1 });
      const hasTextLayer = detectTextLayerAvailability(firstPageMapping);

      setState({
        loading: false,
        error: null,
        document: session.descriptor,
        hasTextLayer,
      });

      return {
        descriptor: session.descriptor,
        firstPageMapping,
        hasTextLayer,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao carregar PDF.";
      setState({ loading: false, error: message, document: null, hasTextLayer: false });
      throw error;
    }
  }, []);

  const getPageMapping = useCallback(async (pageNumber: number): Promise<PageMapping> => {
    if (!sessionRef.current) {
      throw new Error("Nenhum documento PDF ativo.");
    }
    return extractPdfPageMapping({
      session: sessionRef.current,
      pageNumber,
    });
  }, []);

  const renderPage = useCallback(
    async (pageNumber: number, canvas: HTMLCanvasElement) => {
      if (!sessionRef.current) {
        throw new Error("Nenhum documento PDF ativo.");
      }
      return renderPdfPageToCanvas({
        session: sessionRef.current,
        pageNumber,
        canvas,
      });
    },
    [],
  );

  return {
    ...state,
    loadPdfFile,
    getPageMapping,
    renderPage,
  };
}

