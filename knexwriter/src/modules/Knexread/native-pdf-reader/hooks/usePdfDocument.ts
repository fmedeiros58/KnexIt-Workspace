import { useCallback, useState } from "react";
import type { PdfDocumentSource, PdfMetadataRecord } from "../types";
import {
  extractPdfMetadata,
  loadNativePdfSession,
  upsertPdfFileRecord,
} from "../services";
import { pdfReaderRepository } from "../db/pdfReader.repository";
import type { NativePdfSession } from "../services";

type UsePdfDocumentState = {
  loading: boolean;
  error: string | null;
  session: NativePdfSession | null;
  pdfFile: PdfDocumentSource | null;
  metadata: PdfMetadataRecord | null;
};

export function usePdfDocument() {
  const [state, setState] = useState<UsePdfDocumentState>({
    loading: false,
    error: null,
    session: null,
    pdfFile: null,
    metadata: null,
  });

  const openFile = useCallback(
    async (input: { file: File; projectId: string; documentId?: string; sourceId?: string }) => {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const [session, pdfFile] = await Promise.all([
          loadNativePdfSession(input.file),
          upsertPdfFileRecord(input),
        ]);
        const metadata = await extractPdfMetadata(session);
        const enrichedPdfFile: PdfDocumentSource = {
          ...pdfFile,
          title: metadata.title,
          author: metadata.author,
          subject: metadata.subject,
          keywords: metadata.keywords,
          producer: metadata.producer,
          creator: metadata.creator,
          creationDate: metadata.creationDate,
          modificationDate: metadata.modificationDate,
          metadata,
          totalPages: session.pageCount,
          updatedAt: new Date().toISOString(),
        };
        await pdfReaderRepository.putPdfFile(enrichedPdfFile);

        setState({
          loading: false,
          error: null,
          session,
          pdfFile: enrichedPdfFile,
          metadata,
        });
        return {
          session,
          pdfFile: enrichedPdfFile,
          metadata,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Falha ao abrir o PDF.";
        setState({
          loading: false,
          error: message,
          session: null,
          pdfFile: null,
          metadata: null,
        });
        throw error;
      }
    },
    [],
  );

  return {
    ...state,
    openFile,
  };
}
