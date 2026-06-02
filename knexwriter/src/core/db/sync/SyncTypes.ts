import type { SyncChangeLog, SyncStatus, UUID } from "../db.types";

export type ConflictStrategy = "last_write_wins" | "manual_merge" | "keep_local" | "keep_remote" | "field_level_merge";

export interface SyncContext {
  projectId: UUID;
  deviceId: string;
  nowIso: string;
}

export interface RemoteSyncPayload {
  projectId: UUID;
  changes: SyncChangeLog[];
}

export interface RemoteSyncResult {
  appliedChanges: number;
  remoteChanges: SyncChangeLog[];
  errors: Array<{ changeId?: string; message: string }>;
}

export interface EntityVersionEnvelope<T> {
  entityName: string;
  entityId: UUID;
  version: number;
  syncStatus: SyncStatus;
  payload: T;
}

export interface SyncConflict<T = unknown> {
  entityName: string;
  entityId: UUID;
  localVersion: EntityVersionEnvelope<T>;
  remoteVersion: EntityVersionEnvelope<T>;
  detectedAt: string;
}

