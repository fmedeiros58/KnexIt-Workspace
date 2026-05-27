import type { ReferenceSource, UUID } from "../db.types";
import type { BaseRepository } from "./BaseRepository";

export interface ReferenceSourceRepository extends BaseRepository<ReferenceSource> {
  findByDoi(projectId: UUID, doi: string): Promise<ReferenceSource[]>;
  findByIsbn(projectId: UUID, isbn: string): Promise<ReferenceSource[]>;
  findByUrl(projectId: UUID, url: string): Promise<ReferenceSource[]>;
  findByTitleAndYear(projectId: UUID, title: string, year?: string): Promise<ReferenceSource[]>;
  findCitedByDocument(documentId: UUID): Promise<ReferenceSource[]>;
  findUnusedByDocument(documentId: UUID): Promise<ReferenceSource[]>;
  findIncludedInBibliography(documentId: UUID): Promise<ReferenceSource[]>;
  markAsNeedsReview(id: UUID): Promise<void>;
  markAsDuplicated(id: UUID): Promise<void>;
}

