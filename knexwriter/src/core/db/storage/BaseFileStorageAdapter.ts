import { calculateSha256 } from "../../utils/hash/calculateSha256";
import type { FileStorageAdapter, SaveFileInput, SavedFileDescriptor } from "./FileStorageAdapter";
import type { StorageHealth } from "./StorageAdapter";

export abstract class BaseFileStorageAdapter implements FileStorageAdapter {
  abstract readonly name: string;

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
    return Promise.resolve();
  }

  async healthCheck(): Promise<StorageHealth> {
    return { ok: true, message: `${this.name} adapter ready` };
  }

  async calculateHash(bytes: Uint8Array): Promise<string> {
    return calculateSha256(bytes.buffer);
  }

  abstract saveFile(input: SaveFileInput): Promise<SavedFileDescriptor>;
  abstract readFile(storageKey: string): Promise<Uint8Array>;
  abstract deleteFile(storageKey: string): Promise<void>;
  abstract getFileUrl(storageKey: string): Promise<string | null>;
  abstract exists(storageKey: string): Promise<boolean>;
  abstract copyToProject(storageKey: string, targetProjectId: string): Promise<SavedFileDescriptor>;
  abstract resolveLocalPath(storageKey: string): Promise<string | null>;
  abstract resolveRemotePath(storageKey: string): Promise<string | null>;
}

