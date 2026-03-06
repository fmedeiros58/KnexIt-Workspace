import { createVectorDatabaseClient, type VectorDatabaseClient } from "@/core/database/vector-client";

export type ProcessStateV2 = {
  theme?: string;
  definitions?: string[];
  acceptedFacts?: Array<{ text: string; source: string }>;
  usedArguments?: string[];
  usedCitations?: Array<{ docId: number; chunkId: number; pageStart: number | null; pageEnd: number | null }>;
  sectionStatus?: Record<string, string>;
  openQuestions?: string[];
  styleConstraints?: string[];
  [key: string]: unknown;
};

type CheckpointRow = {
  memory_id: string;
  state: ProcessStateV2;
  updated_at: string;
  run_id: string;
};

function toJson(value: unknown) {
  return JSON.stringify(value || {});
}

export class ProcessStoreV2 {
  constructor(private readonly vectorDb: VectorDatabaseClient = createVectorDatabaseClient()) {}

  async upsertCheckpoint(input: {
    memoryId: string;
    conversationId: string;
    runId: string;
    state: ProcessStateV2;
  }) {
    try {
      await this.vectorDb.query(
        `
        insert into rag_v2.process_memory (
          memory_id, conversation_id, run_id, state, updated_at
        )
        values ($1, $2, $3, $4::jsonb, now())
        on conflict (memory_id)
        do update set
          conversation_id = excluded.conversation_id,
          run_id = excluded.run_id,
          state = excluded.state,
          updated_at = now()
        `,
        [input.memoryId, input.conversationId, input.runId, toJson(input.state)],
      );
    } catch {
      // preserve compatibility when migration does not exist yet.
    }
  }

  async getLatestByConversation(conversationId: string): Promise<CheckpointRow | null> {
    try {
      const { rows } = await this.vectorDb.query<CheckpointRow>(
        `
        select memory_id, state, updated_at, run_id
        from rag_v2.process_memory
        where conversation_id = $1
        order by updated_at desc
        limit 1
        `,
        [conversationId],
      );
      if (!rows.length) return null;
      return rows[0];
    } catch {
      return null;
    }
  }
}
