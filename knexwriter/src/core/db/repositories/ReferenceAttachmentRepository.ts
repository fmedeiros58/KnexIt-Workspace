import type { ReferenceAttachment, UUID } from "../db.types";
import type { BaseRepository } from "./BaseRepository";

export interface ReferenceAttachmentRepository extends BaseRepository<ReferenceAttachment> {
  findByReferenceSource(referenceSourceId: UUID): Promise<ReferenceAttachment[]>;
  findByFileAsset(fileAssetId: UUID): Promise<ReferenceAttachment[]>;
}

