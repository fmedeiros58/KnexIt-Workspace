import type { BaseRepository, ListOptions, SearchOptions } from "../repositories";

export class CrudService<T extends { id: string }> {
  constructor(protected readonly repository: BaseRepository<T>) {}

  create(input: Omit<T, "id"> & { id?: string }): Promise<T> {
    return this.repository.create(input);
  }

  update(id: string, patch: Partial<T>): Promise<T> {
    return this.repository.update(id, patch);
  }

  findById(id: string): Promise<T | null> {
    return this.repository.findById(id);
  }

  findByProject(projectId: string): Promise<T[]> {
    return this.repository.findByProject(projectId);
  }

  list(options?: ListOptions): Promise<T[]> {
    return this.repository.list(options);
  }

  search(options: SearchOptions): Promise<T[]> {
    return this.repository.search(options);
  }

  delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }

  softDelete(id: string): Promise<void> {
    return this.repository.softDelete(id);
  }

  restore(id: string): Promise<void> {
    return this.repository.restore(id);
  }
}

