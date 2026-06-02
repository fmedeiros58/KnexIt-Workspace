import type { ProjectFile, UUID } from "../db.types";
import type { BaseRepository } from "./BaseRepository";

export interface ProjectFileRepository extends BaseRepository<ProjectFile> {
  findByDocument(documentId: UUID): Promise<ProjectFile[]>;
  findByFileAsset(fileAssetId: UUID): Promise<ProjectFile[]>;
}

