import { useCallback, useState } from "react";
import type { PdfMetadataRecord, PdfSourceCandidate } from "../types";
import { buildPdfSourceCandidate } from "../services";
import { pdfReaderService } from "../api";

export function usePdfMetadata() {
  const [metadata, setMetadata] = useState<PdfMetadataRecord | null>(null);
  const [referenceCandidate, setReferenceCandidate] =
    useState<PdfSourceCandidate | null>(null);

  const setPdfMetadata = useCallback((nextMetadata: PdfMetadataRecord | null) => {
    setMetadata(nextMetadata);
  }, []);

  const createReferenceCandidate = useCallback(
    async (pdfFileId: string, sourceMetadata?: PdfMetadataRecord | null) => {
      const metadataToUse = sourceMetadata ?? metadata;
      if (!metadataToUse) return null;

      const candidate = buildPdfSourceCandidate({
        pdfFileId,
        metadata: metadataToUse,
      });
      await pdfReaderService.saveReferenceCandidate(candidate);
      setReferenceCandidate(candidate);
      return candidate;
    },
    [metadata],
  );

  return {
    metadata,
    setPdfMetadata,
    referenceCandidate,
    createReferenceCandidate,
  };
}

