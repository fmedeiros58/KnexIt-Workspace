import type { CitationLocator, UUID } from "../db.types";
import type { BaseRepository } from "./BaseRepository";

export interface CitationLocatorRepository extends BaseRepository<CitationLocator> {
  findByCitationOccurrence(citationOccurrenceId: UUID): Promise<CitationLocator[]>;
  findByFileAsset(fileAssetId: UUID): Promise<CitationLocator[]>;
}

