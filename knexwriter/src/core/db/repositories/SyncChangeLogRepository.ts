import type { SyncChangeLog, UUID } from "../db.types";
import type { BaseRepository } from "./BaseRepository";

export interface SyncChangeLogRepository extends BaseRepository<SyncChangeLog> {
  enqueue(change: Omit<SyncChangeLog, "id"> & { id?: UUID }): Promise<SyncChangeLog>;
  listPending(limit?: number): Promise<SyncChangeLog[]>;
  markProcessed(id: UUID, processedAtIso: string): Promise<void>;
  markFailed(id: UUID, errorMessage: string): Promise<void>;
}

