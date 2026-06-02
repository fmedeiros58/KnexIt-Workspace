import type { DocumentCitationLink, UUID } from "../db.types";
import type { DocumentCitationLinkRepository } from "../repositories";
import { CrudService } from "./CrudService";

export class DocumentCitationLinkService extends CrudService<DocumentCitationLink> {
  constructor(protected readonly documentCitationLinkRepository: DocumentCitationLinkRepository) {
    super(documentCitationLinkRepository);
  }

  findByDocument(documentId: UUID): Promise<DocumentCitationLink[]> {
    return this.documentCitationLinkRepository.findByDocument(documentId);
  }
}

