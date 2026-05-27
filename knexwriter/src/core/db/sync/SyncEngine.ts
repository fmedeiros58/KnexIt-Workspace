import { now } from "../../utils/dates/now";
import type { SyncChangeLog } from "../db.types";
import { ConflictResolver } from "./ConflictResolver";
import { LocalChangeTracker } from "./LocalChangeTracker";
import type { RemoteSyncClient } from "./RemoteSyncClient";
import { SyncQueue } from "./SyncQueue";

export class SyncEngine {
  constructor(
    private readonly queue: SyncQueue,
    private readonly remoteClient: RemoteSyncClient,
    private readonly conflictResolver: ConflictResolver,
    private readonly changeTracker: LocalChangeTracker,
  ) {}

  async syncProject(projectId: string): Promise<{
    pushed: number;
    pulled: number;
    conflicts: number;
    errors: string[];
  }> {
    const pendingChanges = await this.queue.listPending();
    const projectChanges = pendingChanges.filter((change) => change.projectId === projectId);
    const pushResult = await this.remoteClient.pushChanges({ projectId, changes: projectChanges });

    for (const change of projectChanges) {
      const syncError = pushResult.errors.find((error) => error.changeId === change.id);
      if (syncError) {
        await this.queue.markFailed(change.id, syncError.message);
      } else {
        await this.queue.markProcessed(change.id, now());
      }
    }

    const pullResult = await this.remoteClient.pullChanges(projectId);
    const conflicts = await this.detectConflicts(projectChanges, pullResult.remoteChanges);

    return {
      pushed: pushResult.appliedChanges,
      pulled: pullResult.appliedChanges,
      conflicts: conflicts.length,
      errors: [...pushResult.errors.map((error) => error.message), ...pullResult.errors.map((error) => error.message)],
    };
  }

  async trackLocalChange(change: Parameters<LocalChangeTracker["track"]>[0]): Promise<void> {
    await this.changeTracker.track(change);
  }

  private async detectConflicts(localChanges: SyncChangeLog[], remoteChanges: SyncChangeLog[]): Promise<SyncChangeLog[]> {
    const conflicts: SyncChangeLog[] = [];

    for (const localChange of localChanges) {
      const remoteMatch = remoteChanges.find(
        (remoteChange) =>
          remoteChange.entityName === localChange.entityName
          && remoteChange.entityId === localChange.entityId
          && remoteChange.id !== localChange.id,
      );
      if (!remoteMatch) continue;

      this.conflictResolver.resolve({
        entityName: localChange.entityName,
        entityId: localChange.entityId,
        detectedAt: now(),
        localVersion: {
          entityName: localChange.entityName,
          entityId: localChange.entityId,
          version: localChange.version,
          syncStatus: localChange.syncStatus,
          payload: localChange.payloadJson ?? {},
        },
        remoteVersion: {
          entityName: remoteMatch.entityName,
          entityId: remoteMatch.entityId,
          version: remoteMatch.version,
          syncStatus: remoteMatch.syncStatus,
          payload: remoteMatch.payloadJson ?? {},
        },
      });
      conflicts.push(localChange);
    }

    return conflicts;
  }
}

