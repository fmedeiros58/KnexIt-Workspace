import type { UUID } from "../db.types";
import { SyncEngine } from "../sync";

export class SyncService {
  constructor(private readonly syncEngine: SyncEngine) {}

  async syncProject(projectId: UUID): Promise<{
    pushed: number;
    pulled: number;
    conflicts: number;
    errors: string[];
  }> {
    return this.syncEngine.syncProject(projectId);
  }

  async notifyLocalChange(input: Parameters<SyncEngine["trackLocalChange"]>[0]): Promise<void> {
    await this.syncEngine.trackLocalChange(input);
  }
}

