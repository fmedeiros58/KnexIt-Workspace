import type { ReferenceAuthor, UUID } from "../db.types";
import type { BaseRepository } from "./BaseRepository";

export interface ReferenceAuthorRepository extends BaseRepository<ReferenceAuthor> {
  findByReferenceSource(referenceSourceId: UUID): Promise<ReferenceAuthor[]>;
  reorder(referenceSourceId: UUID, authorIdsInOrder: UUID[]): Promise<void>;
}

