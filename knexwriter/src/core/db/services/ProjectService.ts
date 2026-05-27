import type { ProjectRepository } from "../repositories";
import type { Project } from "../db.types";
import { CrudService } from "./CrudService";

export class ProjectService extends CrudService<Project> {
  constructor(protected readonly projectRepository: ProjectRepository) {
    super(projectRepository);
  }

  findByOwner(ownerId: string): Promise<Project[]> {
    return this.projectRepository.findByOwner(ownerId);
  }

  archive(projectId: string): Promise<Project> {
    return this.projectRepository.archive(projectId);
  }
}

