import { createId } from "../../../utils/ids/createId";
import { BaseFileStorageAdapter } from "../BaseFileStorageAdapter";
import type { SaveFileInput, SavedFileDescriptor } from "../FileStorageAdapter";

export interface CloudFileStorageAdapterOptions {
  bucket: string;
  provider: "onedrive" | "google_drive" | "s3" | "r2" | "azure_blob" | "cloud_storage";
  baseUrl?: string;
}

export class CloudFileStorageAdapter extends BaseFileStorageAdapter {
  readonly name: string;

  constructor(private readonly options: CloudFileStorageAdapterOptions) {
    super();
    this.name = options.provider;
  }

  async saveFile(input: SaveFileInput): Promise<SavedFileDescriptor> {
    const storageKey = `${this.options.bucket}/${input.projectId}/${input.folderHint ?? "other"}/${createId()}-${input.fileName}`;
    return {
      storageProvider: this.name,
      storageKey,
      remotePath: storageKey,
      sizeBytes: input.bytes.byteLength,
      sha256: await this.calculateHash(input.bytes),
    };
  }

  async readFile(_storageKey: string): Promise<Uint8Array> {
    throw new Error("TODO: cloud readFile implementation.");
  }

  async deleteFile(_storageKey: string): Promise<void> {
    return Promise.resolve();
  }

  async getFileUrl(storageKey: string): Promise<string | null> {
    if (!this.options.baseUrl) return null;
    return `${this.options.baseUrl.replace(/\/$/, "")}/${storageKey}`;
  }

  async exists(_storageKey: string): Promise<boolean> {
    return false;
  }

  async copyToProject(_storageKey: string, _targetProjectId: string): Promise<SavedFileDescriptor> {
    throw new Error("TODO: cloud copyToProject implementation.");
  }

  async resolveLocalPath(_storageKey: string): Promise<string | null> {
    return null;
  }

  async resolveRemotePath(storageKey: string): Promise<string | null> {
    return storageKey;
  }
}

