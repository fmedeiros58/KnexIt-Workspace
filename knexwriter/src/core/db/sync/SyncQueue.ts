import type { SyncChangeLogRepository } from "../repositories";
import type { SyncChangeLog } from "../db.types";

export class SyncQueue {
  constructor(private readonly changeLogRepository: SyncChangeLogRepository) {}

  async enqueue(change: Omit<SyncChangeLog, "id"> & { id?: string }): Promise<SyncChangeLog> {
    return this.changeLogRepository.enqueue(change);
  }

  async listPending(limit = 100): Promise<SyncChangeLog[]> {
    return this.changeLogRepository.listPending(limit);
  }

  async markProcessed(changeId: string, processedAtIso: string): Promise<void> {
    return this.changeLogRepository.markProcessed(changeId, processedAtIso);
  }

  async markFailed(changeId: string, errorMessage: string): Promise<void> {
    return this.changeLogRepository.markFailed(changeId, errorMessage);
  }
}

