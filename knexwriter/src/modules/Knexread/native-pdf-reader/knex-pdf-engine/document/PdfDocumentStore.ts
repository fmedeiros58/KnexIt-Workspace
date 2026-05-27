import type { PdfDocumentMetadata } from "./PdfDocumentMetadata";
import type { PdfPageModel } from "./PdfPageModel";

export type PdfDocumentStoreState = {
  id?: string;
  metadata?: PdfDocumentMetadata;
  pages: Record<number, PdfPageModel>;
  loading: boolean;
  error?: string;
};

export class PdfDocumentStore {
  private state: PdfDocumentStoreState = {
    pages: {},
    loading: false,
  };

  getState() {
    return this.state;
  }

  setLoading(loading: boolean) {
    this.state = { ...this.state, loading };
  }

  setDocument(input: { id: string; metadata: PdfDocumentMetadata }) {
    this.state = {
      ...this.state,
      id: input.id,
      metadata: input.metadata,
      loading: false,
      error: undefined,
    };
  }

  upsertPage(page: PdfPageModel) {
    this.state = {
      ...this.state,
      pages: {
        ...this.state.pages,
        [page.pageNumber]: page,
      },
    };
  }

  setError(error: string) {
    this.state = { ...this.state, loading: false, error };
  }
}
