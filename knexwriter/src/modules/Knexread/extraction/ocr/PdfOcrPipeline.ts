import type { KnexPdfTextBlock } from "../../native-pdf-reader/knex-pdf-engine";
import type { NativePdfSession } from "../../native-pdf-reader/services";

export type PdfOcrPipelineStatus =
  | "not-needed"
  | "needed-unavailable"
  | "ready"
  | "error";

export type PdfOcrPipelineResult = {
  status: PdfOcrPipelineStatus;
  reason: string;
  blocks: KnexPdfTextBlock[];
};

export interface PdfOcrEngineAdapter {
  recognize(input: {
    session: NativePdfSession;
    pageNumber: number;
    scale: number;
    signal?: AbortSignal;
  }): Promise<KnexPdfTextBlock[]>;
}

let ocrEngineAdapter: PdfOcrEngineAdapter | null = null;

export function registerPdfOcrEngineAdapter(adapter: PdfOcrEngineAdapter | null) {
  ocrEngineAdapter = adapter;
}

export async function runPdfOcrPipeline(input: {
  session: NativePdfSession;
  pageNumber: number;
  scale: number;
  shouldRun: boolean;
  reason: string;
  signal?: AbortSignal;
}): Promise<PdfOcrPipelineResult> {
  if (!input.shouldRun) {
    return {
      status: "not-needed",
      reason: input.reason,
      blocks: [],
    };
  }

  if (!ocrEngineAdapter) {
    return {
      status: "needed-unavailable",
      reason: "ocr-engine-adapter-not-registered",
      blocks: [],
    };
  }

  try {
    const blocks = await ocrEngineAdapter.recognize({
      session: input.session,
      pageNumber: input.pageNumber,
      scale: input.scale,
      signal: input.signal,
    });

    return {
      status: "ready",
      reason: input.reason,
      blocks,
    };
  } catch (error) {
    return {
      status: "error",
      reason:
        error instanceof Error ? error.message : "ocr-pipeline-failed",
      blocks: [],
    };
  }
}
