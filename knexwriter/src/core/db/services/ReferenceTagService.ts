import type { ReferenceTag, UUID } from "../db.types";
import type { ReferenceTagRepository } from "../repositories";
import { CrudService } from "./CrudService";

export class ReferenceTagService extends CrudService<ReferenceTag> {
  constructor(protected readonly referenceTagRepository: ReferenceTagRepository) {
    super(referenceTagRepository);
  }

  attachToReferenceSource(referenceSourceId: UUID, referenceTagId: UUID) {
    return this.referenceTagRepository.attachToReferenceSource(referenceSourceId, referenceTagId);
  }

  attachToFileAsset(fileAssetId: UUID, referenceTagId: UUID) {
    return this.referenceTagRepository.attachToFileAsset(fileAssetId, referenceTagId);
  }
}

