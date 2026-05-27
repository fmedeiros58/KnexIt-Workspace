import type { StructuredStorageAdapter } from "../StructuredStorageAdapter";
import type { StorageHealth } from "../../storage/StorageAdapter";

export class IndexedDbStorageAdapter implements StructuredStorageAdapter {
  readonly name = "indexeddb";

  async connect(): Promise<void> {
    return Promise.resolve();
  }

  async disconnect(): Promise<void> {
    return Promise.resolve();
  }

  async transaction<T>(handler: () => Promise<T>): Promise<T> {
    return handler();
  }

  async migrate(): Promise<void> {
    // TODO: apply IndexedDB schema migrations.
    return Promise.resolve();
  }

  async seed(): Promise<void> {
    return Promise.resolve();
  }

  async healthCheck(): Promise<StorageHealth> {
    return { ok: true, message: "IndexedDB adapter available" };
  }

  async getEngineInfo(): Promise<{ engine: string; version?: string }> {
    return { engine: "indexeddb" };
  }
}

