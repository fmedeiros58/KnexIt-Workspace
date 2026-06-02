import type { UUID } from "../db.types";

export interface ListOptions {
  limit?: number;
  offset?: number;
  includeDeleted?: boolean;
}

export interface SearchOptions extends ListOptions {
  query: string;
}

export interface BaseRepository<T extends { id: UUID }> {
  create(input: Omit<T, "id"> & { id?: UUID }): Promise<T>;
  update(id: UUID, patch: Partial<T>): Promise<T>;
  findById(id: UUID): Promise<T | null>;
  findByProject(projectId: UUID): Promise<T[]>;
  list(options?: ListOptions): Promise<T[]>;
  search(options: SearchOptions): Promise<T[]>;
  delete(id: UUID): Promise<void>;
  softDelete(id: UUID): Promise<void>;
  restore(id: UUID): Promise<void>;
}

