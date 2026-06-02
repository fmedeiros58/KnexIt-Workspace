import type { ReferenceAuthor, UUID } from "../db.types";
import type { ReferenceAuthorRepository } from "../repositories";
import { CrudService } from "./CrudService";

export class ReferenceAuthorService extends CrudService<ReferenceAuthor> {
  constructor(protected readonly referenceAuthorRepository: ReferenceAuthorRepository) {
    super(referenceAuthorRepository);
  }

  findByReferenceSource(referenceSourceId: UUID): Promise<ReferenceAuthor[]> {
    return this.referenceAuthorRepository.findByReferenceSource(referenceSourceId);
  }
}

