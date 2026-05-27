import type { DocumentCitationLink, UUID } from "../db.types";
import type { BaseRepository } from "./BaseRepository";

export interface DocumentCitationLinkRepository extends BaseRepository<DocumentCitationLink> {
  findByDocument(documentId: UUID): Promise<DocumentCitationLink[]>;
  findByCitationOccurrence(citationOccurrenceId: UUID): Promise<DocumentCitationLink[]>;
}

