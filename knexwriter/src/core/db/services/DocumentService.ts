import type { Document, UUID } from "../db.types";
import type { DocumentRepository } from "../repositories";
import { now } from "../../utils/dates/now";
import { CrudService } from "./CrudService";

export class DocumentService extends CrudService<Document> {
  constructor(protected readonly documentRepository: DocumentRepository) {
    super(documentRepository);
  }

  findByProjectAndTitle(projectId: UUID, title: string): Promise<Document[]> {
    return this.documentRepository.findByProjectAndTitle(projectId, title);
  }

  async touchLastOpened(documentId: UUID): Promise<void> {
    await this.documentRepository.touchLastOpened(documentId, now());
  }
}

