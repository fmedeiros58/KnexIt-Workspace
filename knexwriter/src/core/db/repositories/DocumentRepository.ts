import type { Document, UUID } from "../db.types";
import type { BaseRepository } from "./BaseRepository";

export interface DocumentRepository extends BaseRepository<Document> {
  findByProjectAndTitle(projectId: UUID, title: string): Promise<Document[]>;
  touchLastOpened(id: UUID, atIso: string): Promise<void>;
}

