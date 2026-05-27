import type { GeneratedBibliographyEntry, UUID } from "../db.types";
import type { GeneratedBibliographyEntryRepository } from "../repositories";
import { CrudService } from "./CrudService";

export class GeneratedBibliographyEntryService extends CrudService<GeneratedBibliographyEntry> {
  constructor(protected readonly generatedBibliographyEntryRepository: GeneratedBibliographyEntryRepository) {
    super(generatedBibliographyEntryRepository);
  }

  findByDocument(documentId: UUID): Promise<GeneratedBibliographyEntry[]> {
    return this.generatedBibliographyEntryRepository.findByDocument(documentId);
  }
}

