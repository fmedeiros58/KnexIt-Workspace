import type {
  PdfBackendAnnotation,
  PdfBackendExtractAnnotationsInput,
} from "../PdfRenderBackend";
import { PdfiumRuntimeLoader } from "./PdfiumRuntimeLoader";

export class PdfiumAnnotationExtractor {
  constructor(private readonly runtimeLoader: PdfiumRuntimeLoader) {}

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
