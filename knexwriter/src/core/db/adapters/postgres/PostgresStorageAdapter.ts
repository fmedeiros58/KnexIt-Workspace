import type { StructuredStorageAdapter } from "../StructuredStorageAdapter";
import type { StorageHealth } from "../../storage/StorageAdapter";

export interface PostgresStorageAdapterOptions {
  connectionString: string;
}

export class PostgresStorageAdapter implements StructuredStorageAdapter {
  readonly name = "postgres";

  constructor(private readonly options: PostgresStorageAdapterOptions) {}

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
    // TODO: apply remote PostgreSQL migrations.
    return Promise.resolve();
  }

  async seed(): Promise<void> {
    return Promise.resolve();
  }

  async healthCheck(): Promise<StorageHealth> {
    return {
      ok: true,
      message: "Postgres adapter configured",
      details: { connectionStringConfigured: Boolean(this.options.connectionString) },
    };
  }

  async getEngineInfo(): Promise<{ engine: string; version?: string }> {
    return { engine: "postgres", version: "todo" };
  }
}

