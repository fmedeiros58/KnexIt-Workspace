import { createId } from "../../utils/ids/createId";
import { now } from "../../utils/dates/now";
import type { JSONValue, SyncOperation, UUID } from "../db.types";
import { SyncQueue } from "./SyncQueue";

export interface TrackChangeInput {
  entityName: string;
  entityId: UUID;
  projectId?: UUID;
  operation: SyncOperation;
  payloadJson?: JSONValue;
  deviceId?: string;
}

export class LocalChangeTracker {
  constructor(private readonly queue: SyncQueue) {}

  async track(input: TrackChangeInput): Promise<void> {
    const timestamp = now();
    await this.queue.enqueue({
      id: createId(),
      entityName: input.entityName,
      entityId: input.entityId,
      projectId: input.projectId,
      operation: input.operation,
      payloadJson: input.payloadJson,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      syncStatus: "local_only",
      remoteId: null,
      version: 1,
      lastSyncedAt: null,
      deviceId: input.deviceId ?? null,
      processedAt: null,
      errorMessage: "",
    });
  }
}
