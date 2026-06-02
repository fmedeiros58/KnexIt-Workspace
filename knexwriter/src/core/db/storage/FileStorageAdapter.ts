import type { StorageAdapter } from "./StorageAdapter";

export interface SaveFileInput {
  projectId: string;
  fileName: string;
  contentType?: string;
  bytes: Uint8Array;
  folderHint?: "pdf" | "images" | "docx" | "audio" | "video" | "other";
}

export interface SavedFileDescriptor {
  storageProvider: string;
  storageKey: string;
  localPath?: string;
  remotePath?: string;
  sizeBytes: number;
  sha256?: string;
}

export interface FileStorageAdapter extends StorageAdapter {
  saveFile(input: SaveFileInput): Promise<SavedFileDescriptor>;
  readFile(storageKey: string): Promise<Uint8Array>;
  deleteFile(storageKey: string): Promise<void>;
  getFileUrl(storageKey: string): Promise<string | null>;
  calculateHash(bytes: Uint8Array): Promise<string>;
  exists(storageKey: string): Promise<boolean>;
  copyToProject(storageKey: string, targetProjectId: string): Promise<SavedFileDescriptor>;
  resolveLocalPath(storageKey: string): Promise<string | null>;
  resolveRemotePath(storageKey: string): Promise<string | null>;
}

