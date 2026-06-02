import type { ReferenceAttachment, UUID } from "../db.types";
import type { ReferenceAttachmentRepository } from "../repositories";
import { CrudService } from "./CrudService";

export class ReferenceAttachmentService extends CrudService<ReferenceAttachment> {
  constructor(protected readonly referenceAttachmentRepository: ReferenceAttachmentRepository) {
    super(referenceAttachmentRepository);
  }

  findByReferenceSource(referenceSourceId: UUID): Promise<ReferenceAttachment[]> {
    return this.referenceAttachmentRepository.findByReferenceSource(referenceSourceId);
  }
}

