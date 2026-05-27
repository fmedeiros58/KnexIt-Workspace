import type { KnexPdfSemanticTextBlock } from "../../core/engineTypes";
import type { PdfBackendExtractTextInput } from "../PdfRenderBackend";
import { PdfiumRuntimeLoader } from "./PdfiumRuntimeLoader";

export class PdfiumTextExtractor {
  constructor(private readonly runtimeLoader: PdfiumRuntimeLoader) {}

  async extract(
    input: PdfBackendExtractTextInput,
  ): Promise<KnexPdfSemanticTextBlock[]> {
    const runtime = await this.runtimeLoader.getRuntime();

    if (!runtime.extractText) {
      return [];
    }

    return runtime.extractText(input);
  }
}
