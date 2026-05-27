import type { KnexPdfCanvasRenderResult } from "../../core/engineTypes";
import type {
  PdfBackendRenderPageInput,
  PdfBackendRenderTileInput,
} from "../PdfRenderBackend";
import { MuPdfRuntimeLoader } from "./MuPdfRuntimeLoader";

export class MuPdfPageRenderer {
  constructor(private readonly runtimeLoader: MuPdfRuntimeLoader) {}

  async render(
    input: PdfBackendRenderPageInput,
  ): Promise<KnexPdfCanvasRenderResult> {
    const runtime = await this.runtimeLoader.getRuntime();
    return runtime.renderPage(input);
  }

  async renderTile(
    input: PdfBackendRenderTileInput,
  ): Promise<KnexPdfCanvasRenderResult> {
    const runtime = await this.runtimeLoader.getRuntime();

    if (typeof runtime.renderTile !== "function") {
      throw new Error("MuPDF runtime does not expose renderTile.");
    }

    return runtime.renderTile(input);
  }
}
