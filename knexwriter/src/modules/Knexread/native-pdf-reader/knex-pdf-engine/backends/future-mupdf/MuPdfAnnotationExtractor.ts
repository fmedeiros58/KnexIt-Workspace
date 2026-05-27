import type {
  PdfBackendAnnotation,
  PdfBackendExtractAnnotationsInput,
} from "../PdfRenderBackend";
import { MuPdfRuntimeLoader } from "./MuPdfRuntimeLoader";

export class MuPdfAnnotationExtractor {
  constructor(private readonly runtimeLoader: MuPdfRuntimeLoader) {}

  async extract(
    input: PdfBackendExtractAnnotationsInput,
  ): Promise<PdfBackendAnnotation[]> {
    const runtime = await this.runtimeLoader.getRuntime();

    if (!runtime.extractAnnotations) {
      return [];
    }

    return runtime.extractAnnotations(input);
  }
}
