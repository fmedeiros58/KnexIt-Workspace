import type { StorageAdapter } from "../storage/StorageAdapter";

export interface StructuredStorageAdapter extends StorageAdapter {
  getEngineInfo(): Promise<{ engine: string; version?: string }>;
}

