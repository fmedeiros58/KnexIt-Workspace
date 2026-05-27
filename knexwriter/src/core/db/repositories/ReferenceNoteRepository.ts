import type { ReferenceNote, UUID } from "../db.types";
import type { BaseRepository } from "./BaseRepository";

export interface ReferenceNoteRepository extends BaseRepository<ReferenceNote> {
  findByReferenceSource(referenceSourceId: UUID): Promise<ReferenceNote[]>;
  findByCitationOccurrence(citationOccurrenceId: UUID): Promise<ReferenceNote[]>;
}

