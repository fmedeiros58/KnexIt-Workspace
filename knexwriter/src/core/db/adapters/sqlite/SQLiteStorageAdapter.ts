import type { StructuredStorageAdapter } from "../StructuredStorageAdapter";
import type { StorageHealth } from "../../storage/StorageAdapter";

export interface SQLiteStorageAdapterOptions {
  dbPath: string;
}

export class SQLiteStorageAdapter implements StructuredStorageAdapter {
  readonly name = "sqlite";

  constructor(private readonly options: SQLiteStorageAdapterOptions) {}

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
    // TODO: execute SQL migrations for desktop SQLite.
    return Promise.resolve();
  }

  async seed(): Promise<void> {
    return Promise.resolve();
  }

  async healthCheck(): Promise<StorageHealth> {
    return {
      ok: true,
      message: "SQLite adapter configured",
      details: { dbPath: this.options.dbPath },
    };
  }

  async getEngineInfo(): Promise<{ engine: string; version?: string }> {
    return { engine: "sqlite", version: "todo" };
  }
}

