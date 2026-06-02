import type { GeneratedBibliographyEntry, UUID } from "../db.types";
import type { BaseRepository } from "./BaseRepository";

export interface RegenerateBibliographyInput {
  projectId: UUID;
  documentId: UUID;
  style: "ABNT" | "APA" | "other";
  entries: Array<Omit<GeneratedBibliographyEntry, "id" | "createdAt" | "updatedAt" | "syncStatus" | "version">>;
}

export interface GeneratedBibliographyEntryRepository extends BaseRepository<GeneratedBibliographyEntry> {
  regenerateForDocument(input: RegenerateBibliographyInput): Promise<GeneratedBibliographyEntry[]>;
  findByDocument(documentId: UUID): Promise<GeneratedBibliographyEntry[]>;
  findByReferenceSource(referenceSourceId: UUID): Promise<GeneratedBibliographyEntry[]>;
  deleteByDocument(documentId: UUID): Promise<void>;
}

