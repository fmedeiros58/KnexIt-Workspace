import type { ReferenceNote, UUID } from "../db.types";
import type { ReferenceNoteRepository } from "../repositories";
import { CrudService } from "./CrudService";

export class ReferenceNoteService extends CrudService<ReferenceNote> {
  constructor(protected readonly referenceNoteRepository: ReferenceNoteRepository) {
    super(referenceNoteRepository);
  }

  findByReferenceSource(referenceSourceId: UUID): Promise<ReferenceNote[]> {
    return this.referenceNoteRepository.findByReferenceSource(referenceSourceId);
  }
}

