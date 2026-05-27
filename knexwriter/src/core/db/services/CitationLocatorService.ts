import type { CitationLocator, UUID } from "../db.types";
import type { CitationLocatorRepository } from "../repositories";
import { CrudService } from "./CrudService";

export class CitationLocatorService extends CrudService<CitationLocator> {
  constructor(protected readonly citationLocatorRepository: CitationLocatorRepository) {
    super(citationLocatorRepository);
  }

  findByCitationOccurrence(citationOccurrenceId: UUID): Promise<CitationLocator[]> {
    return this.citationLocatorRepository.findByCitationOccurrence(citationOccurrenceId);
  }
}

