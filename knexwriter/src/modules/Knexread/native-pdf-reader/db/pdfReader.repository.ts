import {
  NATIVE_PDF_READER_DB_NAME,
  NATIVE_PDF_READER_DB_VERSION,
  NATIVE_PDF_READER_STORES,
} from "./pdfReader.migrations";
import type {
  PdfAnnotationStoreRecord,
  PdfCitationStoreRecord,
  PdfFileBlobRecord,
  PdfFileRecord,
  PdfGeoTextStoreRecord,
  PdfHighlightStoreRecord,
  PdfReaderPreferencesStoreRecord,
  PdfReaderSessionStoreRecord,
  PdfReferenceCandidateStoreRecord,
  PdfTranslationBlockStoreRecord,
  PdfTranslationRevisionStoreRecord,
} from "./pdfReader.schema";

type NativePdfReaderStoreName =
  (typeof NATIVE_PDF_READER_STORES)[keyof typeof NATIVE_PDF_READER_STORES];

type StoreByName = {
  [NATIVE_PDF_READER_STORES.pdfFiles]: PdfFileRecord;
  [NATIVE_PDF_READER_STORES.pdfFileBlobs]: PdfFileBlobRecord;
  [NATIVE_PDF_READER_STORES.sessions]: PdfReaderSessionStoreRecord;
  [NATIVE_PDF_READER_STORES.highlights]: PdfHighlightStoreRecord;
  [NATIVE_PDF_READER_STORES.annotations]: PdfAnnotationStoreRecord;
  [NATIVE_PDF_READER_STORES.citations]: PdfCitationStoreRecord;
  [NATIVE_PDF_READER_STORES.referenceCandidates]: PdfReferenceCandidateStoreRecord;
  [NATIVE_PDF_READER_STORES.geoTextBlocks]: PdfGeoTextStoreRecord;
  [NATIVE_PDF_READER_STORES.translationBlocks]: PdfTranslationBlockStoreRecord;
  [NATIVE_PDF_READER_STORES.translationRevisions]: PdfTranslationRevisionStoreRecord;
  [NATIVE_PDF_READER_STORES.readerPreferences]: PdfReaderPreferencesStoreRecord;
};

export class PdfReaderRepository {
  private dbPromise: Promise<IDBDatabase> | null = null;

  async putPdfFile(record: PdfFileRecord) {
    await this.put(NATIVE_PDF_READER_STORES.pdfFiles, record);
  }

  async getPdfFileById(id: string) {
    return this.getByKey(NATIVE_PDF_READER_STORES.pdfFiles, id);
  }

  async getPdfFileByFingerprint(fingerprint: string) {
    return this.getByIndex(
      NATIVE_PDF_READER_STORES.pdfFiles,
      "by_fingerprint",
      fingerprint,
    );
  }

  async listPdfFilesByProject(projectId: string) {
    return this.listByIndex(
      NATIVE_PDF_READER_STORES.pdfFiles,
      "by_project",
      projectId,
    );
  }

  async putPdfFileBlob(record: PdfFileBlobRecord) {
    await this.put(NATIVE_PDF_READER_STORES.pdfFileBlobs, record);
  }

  async getPdfFileBlob(pdfFileId: string) {
    return this.getByKey(NATIVE_PDF_READER_STORES.pdfFileBlobs, pdfFileId);
  }

  async putSession(record: PdfReaderSessionStoreRecord) {
    await this.put(NATIVE_PDF_READER_STORES.sessions, record);
  }

  async getSessionByPdfFile(pdfFileId: string) {
    return this.getByIndex(
      NATIVE_PDF_READER_STORES.sessions,
      "by_pdf_file",
      pdfFileId,
    );
  }

  async putHighlight(record: PdfHighlightStoreRecord) {
    await this.put(NATIVE_PDF_READER_STORES.highlights, record);
  }

  async listHighlightsByPdfFile(pdfFileId: string) {
    return this.listByIndex(
      NATIVE_PDF_READER_STORES.highlights,
      "by_pdf_file",
      pdfFileId,
    );
  }

  async updateHighlight(
    id: string,
    patch: Partial<PdfHighlightStoreRecord>,
  ): Promise<PdfHighlightStoreRecord | null> {
    const current = await this.getByKey(NATIVE_PDF_READER_STORES.highlights, id);
    if (!current) return null;
    const next: PdfHighlightStoreRecord = {
      ...current,
      ...patch,
      id: current.id,
      updatedAt: new Date().toISOString(),
    };
    await this.put(NATIVE_PDF_READER_STORES.highlights, next);
    return next;
  }

  async deleteHighlight(id: string) {
    await this.deleteByKey(NATIVE_PDF_READER_STORES.highlights, id);
  }

  async putAnnotation(record: PdfAnnotationStoreRecord) {
    await this.put(NATIVE_PDF_READER_STORES.annotations, record);
  }

  async listAnnotationsByPdfFile(pdfFileId: string) {
    return this.listByIndex(
      NATIVE_PDF_READER_STORES.annotations,
      "by_pdf_file",
      pdfFileId,
    );
  }

  async updateAnnotation(
    id: string,
    patch: Partial<PdfAnnotationStoreRecord>,
  ): Promise<PdfAnnotationStoreRecord | null> {
    const current = await this.getByKey(
      NATIVE_PDF_READER_STORES.annotations,
      id,
    );
    if (!current) return null;
    const next: PdfAnnotationStoreRecord = {
      ...current,
      ...patch,
      id: current.id,
      updatedAt: new Date().toISOString(),
    };
    await this.put(NATIVE_PDF_READER_STORES.annotations, next);
    return next;
  }

  async deleteAnnotation(id: string) {
    await this.deleteByKey(NATIVE_PDF_READER_STORES.annotations, id);
  }

  async putCitation(record: PdfCitationStoreRecord) {
    await this.put(NATIVE_PDF_READER_STORES.citations, record);
  }

  async getCitationById(id: string) {
    return this.getByKey(NATIVE_PDF_READER_STORES.citations, id);
  }

  async listCitationsByPdfFile(pdfFileId: string) {
    return this.listByIndex(
      NATIVE_PDF_READER_STORES.citations,
      "by_pdf_file",
      pdfFileId,
    );
  }

  async updateCitation(
    id: string,
    patch: Partial<PdfCitationStoreRecord>,
  ): Promise<PdfCitationStoreRecord | null> {
    const current = await this.getByKey(NATIVE_PDF_READER_STORES.citations, id);
    if (!current) return null;
    const next: PdfCitationStoreRecord = {
      ...current,
      ...patch,
      id: current.id,
      updatedAt: new Date().toISOString(),
    };
    await this.put(NATIVE_PDF_READER_STORES.citations, next);
    return next;
  }

  async putReferenceCandidate(record: PdfReferenceCandidateStoreRecord) {
    await this.put(NATIVE_PDF_READER_STORES.referenceCandidates, record);
  }

  async getReferenceCandidateByPdfFile(pdfFileId: string) {
    return this.getByKey(NATIVE_PDF_READER_STORES.referenceCandidates, pdfFileId);
  }

  async putGeoTextBlocks(records: PdfGeoTextStoreRecord[]) {
    await this.putMany(NATIVE_PDF_READER_STORES.geoTextBlocks, records);
  }

  async listGeoTextBlocksByPdfFile(pdfFileId: string) {
    return this.listByIndex(
      NATIVE_PDF_READER_STORES.geoTextBlocks,
      "by_pdf_file",
      pdfFileId,
    );
  }

  async listGeoTextBlocksByPdfFileAndPage(pdfFileId: string, pageNumber: number) {
    return this.listByIndex(
      NATIVE_PDF_READER_STORES.geoTextBlocks,
      "by_pdf_page",
      [pdfFileId, pageNumber],
    );
  }

  async putTranslationBlocks(records: PdfTranslationBlockStoreRecord[]) {
    await this.putMany(NATIVE_PDF_READER_STORES.translationBlocks, records);
  }

  async putTranslationBlock(record: PdfTranslationBlockStoreRecord) {
    await this.put(NATIVE_PDF_READER_STORES.translationBlocks, record);
  }

  async getTranslationBlockById(id: string) {
    return this.getByKey(NATIVE_PDF_READER_STORES.translationBlocks, id);
  }

  async listTranslationBlocksByPdfFile(pdfFileId: string) {
    return this.listByIndex(
      NATIVE_PDF_READER_STORES.translationBlocks,
      "by_pdf_file",
      pdfFileId,
    );
  }

  async listTranslationBlocksByPdfFileAndPage(pdfFileId: string, pageNumber: number) {
    return this.listByIndex(
      NATIVE_PDF_READER_STORES.translationBlocks,
      "by_pdf_page",
      [pdfFileId, pageNumber],
    );
  }

  async updateTranslationBlock(
    id: string,
    patch: Partial<PdfTranslationBlockStoreRecord>,
  ): Promise<PdfTranslationBlockStoreRecord | null> {
    const current = await this.getByKey(NATIVE_PDF_READER_STORES.translationBlocks, id);
    if (!current) return null;
    const next: PdfTranslationBlockStoreRecord = {
      ...current,
      ...patch,
      id: current.id,
      updatedAt: new Date().toISOString(),
    };
    await this.put(NATIVE_PDF_READER_STORES.translationBlocks, next);
    return next;
  }

  async putTranslationRevision(record: PdfTranslationRevisionStoreRecord) {
    await this.put(NATIVE_PDF_READER_STORES.translationRevisions, record);
  }

  async listTranslationRevisionsByBlock(translationBlockId: string) {
    return this.listByIndex(
      NATIVE_PDF_READER_STORES.translationRevisions,
      "by_translation_block",
      translationBlockId,
    );
  }

  async putReaderPreferences(record: PdfReaderPreferencesStoreRecord) {
    await this.put(NATIVE_PDF_READER_STORES.readerPreferences, record);
  }

  async getReaderPreferencesById(id: string) {
    return this.getByKey(NATIVE_PDF_READER_STORES.readerPreferences, id);
  }

  private async put<K extends NativePdfReaderStoreName>(
    storeName: K,
    value: StoreByName[K],
  ) {
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB put failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB put aborted"));
    });
  }

  private async putMany<K extends NativePdfReaderStoreName>(
    storeName: K,
    values: Array<StoreByName[K]>,
  ) {
    if (!values.length) return;
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      values.forEach((value) => store.put(value));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB bulk put failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB bulk put aborted"));
    });
  }

  private async getByKey<K extends NativePdfReaderStoreName>(
    storeName: K,
    key: IDBValidKey,
  ) {
    const db = await this.openDb();
    return new Promise<StoreByName[K] | null>((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).get(key);
      request.onsuccess = () =>
        resolve((request.result as StoreByName[K] | undefined) ?? null);
      request.onerror = () =>
        reject(request.error ?? new Error("IndexedDB get failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB get aborted"));
    });
  }

  private async getByIndex<K extends NativePdfReaderStoreName>(
    storeName: K,
    indexName: string,
    key: IDBValidKey,
  ) {
    const db = await this.openDb();
    return new Promise<StoreByName[K] | null>((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).index(indexName).get(key);
      request.onsuccess = () =>
        resolve((request.result as StoreByName[K] | undefined) ?? null);
      request.onerror = () =>
        reject(request.error ?? new Error("IndexedDB index get failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB index get aborted"));
    });
  }

  private async listByIndex<K extends NativePdfReaderStoreName>(
    storeName: K,
    indexName: string,
    key: IDBValidKey,
  ) {
    const db = await this.openDb();
    return new Promise<Array<StoreByName[K]>>((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).index(indexName).getAll(key);
      request.onsuccess = () => resolve((request.result as Array<StoreByName[K]>) ?? []);
      request.onerror = () =>
        reject(request.error ?? new Error("IndexedDB index getAll failed"));
      tx.onabort = () =>
        reject(tx.error ?? new Error("IndexedDB index getAll aborted"));
    });
  }

  private async deleteByKey<K extends NativePdfReaderStoreName>(
    storeName: K,
    key: IDBValidKey,
  ) {
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB delete aborted"));
    });
  }

  private async openDb() {
    if (typeof window === "undefined" || !window.indexedDB) {
      throw new Error("IndexedDB indisponivel neste ambiente.");
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = window.indexedDB.open(
          NATIVE_PDF_READER_DB_NAME,
          NATIVE_PDF_READER_DB_VERSION,
        );

        request.onupgradeneeded = () => {
          const db = request.result;
          const tx = request.transaction;
          if (!tx) return;
          this.ensureStore(db, tx, NATIVE_PDF_READER_STORES.pdfFiles, "id", (store) => {
            this.createIndexIfMissing(store, "by_project", "projectId", {
              unique: false,
            });
            this.createIndexIfMissing(store, "by_document", "documentId", {
              unique: false,
            });
            this.createIndexIfMissing(store, "by_fingerprint", "fingerprint", {
              unique: false,
            });
          });
          this.ensureStore(
            db,
            tx,
            NATIVE_PDF_READER_STORES.pdfFileBlobs,
            "pdfFileId",
          );
          this.ensureStore(db, tx, NATIVE_PDF_READER_STORES.sessions, "id", (store) => {
            this.createIndexIfMissing(store, "by_pdf_file", "pdfFileId", {
              unique: true,
            });
            this.createIndexIfMissing(store, "by_project", "projectId", {
              unique: false,
            });
          });
          this.ensureStore(db, tx, NATIVE_PDF_READER_STORES.highlights, "id", (store) => {
            this.createIndexIfMissing(store, "by_pdf_file", "pdfFileId", {
              unique: false,
            });
            this.createIndexIfMissing(store, "by_project", "projectId", {
              unique: false,
            });
          });
          this.ensureStore(
            db,
            tx,
            NATIVE_PDF_READER_STORES.annotations,
            "id",
            (store) => {
              this.createIndexIfMissing(store, "by_pdf_file", "pdfFileId", {
                unique: false,
              });
              this.createIndexIfMissing(store, "by_highlight", "highlightId", {
                unique: false,
              });
            },
          );
          this.ensureStore(db, tx, NATIVE_PDF_READER_STORES.citations, "id", (store) => {
            this.createIndexIfMissing(store, "by_pdf_file", "pdfFileId", {
              unique: false,
            });
            this.createIndexIfMissing(store, "by_document", "documentId", {
              unique: false,
            });
            this.createIndexIfMissing(store, "by_highlight", "highlightId", {
              unique: false,
            });
          });
          this.ensureStore(
            db,
            tx,
            NATIVE_PDF_READER_STORES.referenceCandidates,
            "pdfFileId",
            (store) => {
              this.createIndexIfMissing(store, "by_confidence", "confidence", {
                unique: false,
              });
            },
          );
          this.ensureStore(
            db,
            tx,
            NATIVE_PDF_READER_STORES.geoTextBlocks,
            "id",
            (store) => {
              this.createIndexIfMissing(store, "by_pdf_file", "pdfFileId", {
                unique: false,
              });
              this.createIndexIfMissing(store, "by_document", "documentId", {
                unique: false,
              });
              this.createIndexIfMissing(store, "by_pdf_page", ["pdfFileId", "pageNumber"], {
                unique: false,
              });
            },
          );
          this.ensureStore(
            db,
            tx,
            NATIVE_PDF_READER_STORES.translationBlocks,
            "id",
            (store) => {
              this.createIndexIfMissing(store, "by_pdf_file", "pdfFileId", {
                unique: false,
              });
              this.createIndexIfMissing(store, "by_document", "documentId", {
                unique: false,
              });
              this.createIndexIfMissing(store, "by_pdf_page", ["pdfFileId", "pageNumber"], {
                unique: false,
              });
              this.createIndexIfMissing(store, "by_status", "status", {
                unique: false,
              });
            },
          );
          this.ensureStore(
            db,
            tx,
            NATIVE_PDF_READER_STORES.translationRevisions,
            "id",
            (store) => {
              this.createIndexIfMissing(
                store,
                "by_translation_block",
                "translationBlockId",
                { unique: false },
              );
              this.createIndexIfMissing(store, "by_pdf_file", "pdfFileId", {
                unique: false,
              });
            },
          );
          this.ensureStore(
            db,
            tx,
            NATIVE_PDF_READER_STORES.readerPreferences,
            "id",
            (store) => {
              this.createIndexIfMissing(store, "by_project", "projectId", {
                unique: false,
              });
              this.createIndexIfMissing(store, "by_document", "documentId", {
                unique: false,
              });
            },
          );
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(request.error ?? new Error("Failed to open native pdf db"));
      });
    }

    return this.dbPromise;
  }

  private ensureStore(
    db: IDBDatabase,
    transaction: IDBTransaction,
    name: NativePdfReaderStoreName,
    keyPath: string | string[],
    createIndexes?: (store: IDBObjectStore) => void,
  ) {
    const store = db.objectStoreNames.contains(name)
      ? transaction.objectStore(name)
      : db.createObjectStore(name, { keyPath });

    createIndexes?.(store);
  }

  private createIndexIfMissing(
    store: IDBObjectStore,
    indexName: string,
    keyPath: string | string[],
    options?: IDBIndexParameters,
  ) {
    if (!store.indexNames.contains(indexName)) {
      store.createIndex(indexName, keyPath, options);
    }
  }
}

export const pdfReaderRepository = new PdfReaderRepository();
