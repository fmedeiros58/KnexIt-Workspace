import { createVectorDatabaseClient, type VectorDatabaseClient } from "@/core/database/vector-client";
import type { ClaimCitation } from "@/core/rag/v2/citations/aligner_v2";

type JsonValue = Record<string, unknown>;

function toJson(value: unknown) {
  return JSON.stringify(value || {});
}

function sanitizeError(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 280);
  return `${error}`.slice(0, 280);
}

export class RunAuditRepositoryV2 {
  constructor(private readonly vectorDb: VectorDatabaseClient = createVectorDatabaseClient()) {}

  async writeRetrievalRun(input: {
    runId: string;
    requestId: string;
    queryText: string;
    queryHash: string;
    pipelineVersion: string;
    params: JsonValue;
    results: JsonValue;
  }) {
    try {
      await this.vectorDb.query(
        `
        insert into rag_v2.retrieval_runs (
          run_id, request_id, query_text, query_hash, pipeline_version, params, results, created_at
        )
        values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, now())
        `,
        [
          input.runId,
          input.requestId,
          input.queryText,
          input.queryHash,
          input.pipelineVersion,
          toJson(input.params),
          toJson(input.results),
        ],
      );
    } catch (error) {
      // No-op to preserve backward compatibility if migration is pending.
      void sanitizeError(error);
    }
  }

  async writeGenerationRun(input: {
    runId: string;
    requestId: string;
    pipelineVersion: string;
    mode: "chat" | "write";
    promptMeta: JsonValue;
    tokenMeta: JsonValue;
  }) {
    try {
      await this.vectorDb.query(
        `
        insert into rag_v2.generation_runs (
          run_id, request_id, pipeline_version, mode, prompt_meta, token_meta, created_at
        )
        values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, now())
        `,
        [
          input.runId,
          input.requestId,
          input.pipelineVersion,
          input.mode,
          toJson(input.promptMeta),
          toJson(input.tokenMeta),
        ],
      );
    } catch (error) {
      void sanitizeError(error);
    }
  }

  async writeCitations(runId: string, citations: ClaimCitation[]) {
    if (!citations.length) return;
    try {
      const payload = citations.map((row) => ({
        claim_id: row.claimId,
        doc_id: row.docId,
        chunk_id: row.chunkId,
        page_start: row.pageStart,
        page_end: row.pageEnd,
        quote_span: null,
        score: row.score,
      }));
      await this.vectorDb.query(
        `
        insert into rag_v2.citations (
          run_id, claim_id, doc_id, chunk_id, page_start, page_end, quote_span, score, created_at
        )
        select
          $1,
          c.claim_id,
          c.doc_id,
          c.chunk_id,
          c.page_start,
          c.page_end,
          c.quote_span,
          c.score,
          now()
        from jsonb_to_recordset($2::jsonb) as c(
          claim_id text,
          doc_id bigint,
          chunk_id bigint,
          page_start integer,
          page_end integer,
          quote_span text,
          score double precision
        )
        `,
        [runId, JSON.stringify(payload)],
      );
    } catch (error) {
      void sanitizeError(error);
    }
  }
}
