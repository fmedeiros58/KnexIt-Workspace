import type { ConflictStrategy, EntityVersionEnvelope, SyncConflict } from "./SyncTypes";

export class ConflictResolver {
  constructor(private readonly strategy: ConflictStrategy = "last_write_wins") {}

  resolve<T>(conflict: SyncConflict<T>): EntityVersionEnvelope<T> {
    switch (this.strategy) {
      case "keep_local":
        return conflict.localVersion;
      case "keep_remote":
        return conflict.remoteVersion;
      case "last_write_wins":
        return this.resolveLastWriteWins(conflict);
      case "manual_merge":
      case "field_level_merge":
      default:
        // TODO: provide UI/merge policies later.
        return this.resolveLastWriteWins(conflict);
    }
  }

  private resolveLastWriteWins<T>(conflict: SyncConflict<T>): EntityVersionEnvelope<T> {
    return conflict.localVersion.version >= conflict.remoteVersion.version
      ? conflict.localVersion
      : conflict.remoteVersion;
  }
}

