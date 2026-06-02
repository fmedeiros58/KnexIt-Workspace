import { createId } from "../../../utils/ids/createId";
import { KNEXWRITER_DESKTOP_PROJECT_LAYOUT } from "../../db.constants";
import { BaseFileStorageAdapter } from "../BaseFileStorageAdapter";
import type { SaveFileInput, SavedFileDescriptor } from "../FileStorageAdapter";

export interface DesktopFileStorageAdapterOptions {
  projectsRootPath: string;
}

export class DesktopFileStorageAdapter extends BaseFileStorageAdapter {
  readonly name = "desktop_filesystem";

  constructor(private readonly options: DesktopFileStorageAdapterOptions) {
    super();
  }

  async saveFile(input: SaveFileInput): Promise<SavedFileDescriptor> {
    const folder = input.folderHint ?? "other";
    const storageKey = [
      this.options.projectsRootPath,
      input.projectId,
      KNEXWRITER_DESKTOP_PROJECT_LAYOUT.filesFolderName,
      folder,
      `${createId()}-${input.fileName}`,
    ].join("/");

    return {
      storageProvider: this.name,
      storageKey,
      localPath: storageKey,
      sizeBytes: input.bytes.byteLength,
      sha256: await this.calculateHash(input.bytes),
    };
  }

  async readFile(_storageKey: string): Promise<Uint8Array> {
    throw new Error("TODO: desktop readFile implementation.");
  }

  async deleteFile(_storageKey: string): Promise<void> {
    return Promise.resolve();
  }

  async getFileUrl(storageKey: string): Promise<string | null> {
    return `file://${storageKey}`;
  }

  async exists(_storageKey: string): Promise<boolean> {
    return false;
  }

  async copyToProject(_storageKey: string, _targetProjectId: string): Promise<SavedFileDescriptor> {
    throw new Error("TODO: desktop copyToProject implementation.");
  }

  async resolveLocalPath(storageKey: string): Promise<string | null> {
    return storageKey;
  }

  async resolveRemotePath(_storageKey: string): Promise<string | null> {
    return null;
  }
}

