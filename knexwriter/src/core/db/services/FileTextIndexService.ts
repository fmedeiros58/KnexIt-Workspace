import type { FileTextIndex, UUID } from "../db.types";
import type { FileTextIndexRepository } from "../repositories";
import { CrudService } from "./CrudService";

export class FileTextIndexService extends CrudService<FileTextIndex> {
  constructor(protected readonly fileTextIndexRepository: FileTextIndexRepository) {
    super(fileTextIndexRepository);
  }

  indexPage(chunk: Omit<FileTextIndex, "id"> & { id?: UUID }): Promise<FileTextIndex> {
    return this.fileTextIndexRepository.indexPage(chunk);
  }

  searchInProjectFiles(projectId: UUID, query: string, limit?: number): Promise<FileTextIndex[]> {
    return this.fileTextIndexRepository.searchInProjectFiles(projectId, query, limit);
  }
}

