import type { FileAsset } from "../db.types";
import type { BaseRepository } from "./BaseRepository";

export interface FileAssetRepository extends BaseRepository<FileAsset> {
  findByChecksum(checksum: string): Promise<FileAsset[]>;
  findByStorageKey(storageKey: string): Promise<FileAsset | null>;
}

