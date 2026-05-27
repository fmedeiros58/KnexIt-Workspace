import { createId } from "../../../utils/ids/createId";
import { BaseFileStorageAdapter } from "../BaseFileStorageAdapter";
import type { SaveFileInput, SavedFileDescriptor } from "../FileStorageAdapter";

export class OpfsFileStorageAdapter extends BaseFileStorageAdapter {
  readonly name = "opfs";

  async saveFile(input: SaveFileInput): Promise<SavedFileDescriptor> {
    const storageKey = `knexwriter/projects/${input.projectId}/files/${input.folderHint ?? "other"}/${createId()}-${input.fileName}`;
    return {
      storageProvider: this.name,
      storageKey,
      localPath: storageKey,
      sizeBytes: input.bytes.byteLength,
      sha256: await this.calculateHash(input.bytes),
    };
  }

  async readFile(_storageKey: string): Promise<Uint8Array> {
    throw new Error("TODO: OPFS readFile implementation.");
  }

  async deleteFile(_storageKey: string): Promise<void> {
    return Promise.resolve();
  }

  async getFileUrl(_storageKey: string): Promise<string | null> {
    return null;
  }

  async exists(_storageKey: string): Promise<boolean> {
    return false;
  }

  async copyToProject(_storageKey: string, _targetProjectId: string): Promise<SavedFileDescriptor> {
    throw new Error("TODO: OPFS copyToProject implementation.");
  }

  async resolveLocalPath(storageKey: string): Promise<string | null> {
    return storageKey;
  }

  async resolveRemotePath(_storageKey: string): Promise<string | null> {
    return null;
  }
}

