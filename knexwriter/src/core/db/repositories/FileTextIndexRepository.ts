import type { FileTextIndex, UUID } from "../db.types";
import type { BaseRepository } from "./BaseRepository";

export interface FileTextIndexRepository extends BaseRepository<FileTextIndex> {
  indexPage(chunk: Omit<FileTextIndex, "id"> & { id?: UUID }): Promise<FileTextIndex>;
  searchInProjectFiles(projectId: UUID, query: string, limit?: number): Promise<FileTextIndex[]>;
  searchInFile(fileAssetId: UUID, query: string, limit?: number): Promise<FileTextIndex[]>;
  findByPage(fileAssetId: UUID, pageNumber: number): Promise<FileTextIndex[]>;
  deleteByFile(fileAssetId: UUID): Promise<void>;
}

