import type { FileAssetTag, ReferenceSourceTag, ReferenceTag, UUID } from "../db.types";
import type { BaseRepository } from "./BaseRepository";

export interface ReferenceTagRepository extends BaseRepository<ReferenceTag> {
  attachToReferenceSource(referenceSourceId: UUID, referenceTagId: UUID): Promise<ReferenceSourceTag>;
  detachFromReferenceSource(referenceSourceId: UUID, referenceTagId: UUID): Promise<void>;
  attachToFileAsset(fileAssetId: UUID, referenceTagId: UUID): Promise<FileAssetTag>;
  detachFromFileAsset(fileAssetId: UUID, referenceTagId: UUID): Promise<void>;
  listByReferenceSource(referenceSourceId: UUID): Promise<ReferenceTag[]>;
  listByFileAsset(fileAssetId: UUID): Promise<ReferenceTag[]>;
}

