import type { Project, UUID } from "../db.types";
import type { BaseRepository } from "./BaseRepository";

export interface ProjectRepository extends BaseRepository<Project> {
  findByOwner(ownerId: string): Promise<Project[]>;
  archive(id: UUID): Promise<Project>;
}

