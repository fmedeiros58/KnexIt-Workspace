import type { KnexPdfSemanticTextBlock } from "../../core/engineTypes";
import type { PdfBackendExtractTextInput } from "../PdfRenderBackend";
import { MuPdfRuntimeLoader } from "./MuPdfRuntimeLoader";

export class MuPdfTextExtractor {
  constructor(private readonly runtimeLoader: MuPdfRuntimeLoader) {}

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
