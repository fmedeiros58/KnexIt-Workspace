import type { ProjectFile, UUID } from "../db.types";
import type { ProjectFileRepository } from "../repositories";
import { CrudService } from "./CrudService";

export class ProjectFileService extends CrudService<ProjectFile> {
  constructor(protected readonly projectFileRepository: ProjectFileRepository) {
    super(projectFileRepository);
  }

  findByDocument(documentId: UUID): Promise<ProjectFile[]> {
    return this.projectFileRepository.findByDocument(documentId);
  }

  findByFileAsset(fileAssetId: UUID): Promise<ProjectFile[]> {
    return this.projectFileRepository.findByFileAsset(fileAssetId);
  }
}

