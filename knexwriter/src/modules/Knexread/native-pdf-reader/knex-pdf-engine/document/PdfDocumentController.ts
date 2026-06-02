import type { PdfDocumentMetadata } from "./PdfDocumentMetadata";
import type { PdfPageModel } from "./PdfPageModel";
import { PdfDocumentStore } from "./PdfDocumentStore";

export class PdfDocumentController {
  constructor(readonly store = new PdfDocumentStore()) {}

  beginLoad() {
    this.store.setLoading(true);
  }

  completeLoad(input: {
    id: string;
    metadata: PdfDocumentMetadata;
    pages?: PdfPageModel[];
  }) {
    this.store.setDocument({
      id: input.id,
      metadata: input.metadata,
    });
    input.pages?.forEach((page) => this.store.upsertPage(page));
  }

  failLoad(error: unknown) {
    this.store.setError(error instanceof Error ? error.message : "Failed to load PDF document.");
  }
}
