import type { RemoteSyncPayload, RemoteSyncResult } from "./SyncTypes";

export interface RemoteSyncClient {
  pushChanges(payload: RemoteSyncPayload): Promise<RemoteSyncResult>;
  pullChanges(projectId: string, sinceIso?: string): Promise<RemoteSyncResult>;
}

export class HttpRemoteSyncClient implements RemoteSyncClient {
  constructor(private readonly baseUrl: string, private readonly authToken?: string) {}

  async pushChanges(_payload: RemoteSyncPayload): Promise<RemoteSyncResult> {
    // TODO: call remote sync endpoint.
    return { appliedChanges: 0, remoteChanges: [], errors: [] };
  }

  async pullChanges(_projectId: string, _sinceIso?: string): Promise<RemoteSyncResult> {
    // TODO: call remote sync endpoint.
    return { appliedChanges: 0, remoteChanges: [], errors: [] };
  }

  get endpoint(): string {
    return this.baseUrl;
  }

  get hasToken(): boolean {
    return Boolean(this.authToken);
  }
}

