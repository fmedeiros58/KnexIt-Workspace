import type { FileAssetRepository } from "../repositories";
import type { FileAsset } from "../db.types";
import { CrudService } from "./CrudService";

export class FileAssetService extends CrudService<FileAsset> {
  constructor(protected readonly fileAssetRepository: FileAssetRepository) {
    super(fileAssetRepository);
  }

  findByChecksum(checksum: string): Promise<FileAsset[]> {
    return this.fileAssetRepository.findByChecksum(checksum);
  }

  findByStorageKey(storageKey: string): Promise<FileAsset | null> {
    return this.fileAssetRepository.findByStorageKey(storageKey);
  }
}

