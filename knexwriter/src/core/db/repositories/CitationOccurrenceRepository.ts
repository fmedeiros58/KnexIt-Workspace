import type { CitationOccurrence, UUID } from "../db.types";
import type { BaseRepository } from "./BaseRepository";

export interface CitationOccurrenceRepository extends BaseRepository<CitationOccurrence> {
  findByDocument(documentId: UUID): Promise<CitationOccurrence[]>;
  findByReferenceSource(referenceSourceId: UUID): Promise<CitationOccurrence[]>;
  findActiveByDocument(documentId: UUID): Promise<CitationOccurrence[]>;
  findUnusedByDocument(documentId: UUID): Promise<CitationOccurrence[]>;
  markAsUnused(id: UUID): Promise<void>;
  markAsOrphaned(id: UUID): Promise<void>;
  markAsBrokenLocator(id: UUID): Promise<void>;
}

