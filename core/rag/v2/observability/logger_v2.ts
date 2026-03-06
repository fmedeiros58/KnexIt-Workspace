import { createHash, randomUUID } from "crypto";

import { logger } from "@/core/utils/logger";

export type StageName =
  | "query_received"
  | "embedding"
  | "vector_retrieval"
  | "lexical_retrieval"
  | "hybrid_combine"
  | "rerank"
  | "context_pack"
  | "generation"
  | "citations"
  | "writer_pipeline"
  | "writer_planner"
  | "writer_section"
  | "writer_merge";

export type StageTelemetry = {
  stage: StageName;
  startedAtMs: number;
  finishedAtMs: number;
  elapsedMs: number;
  details?: Record<string, unknown>;
};

export type PipelineTrace = {
  requestId: string;
  runId: string;
  pipelineVersion: "v1" | "v2";
  stages: StageTelemetry[];
};

export function makeRunId(prefix = "ragv2") {
  return `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function hashText(value: string) {
  return createHash("sha256").update(`${value || ""}`).digest("hex");
}

export function startTrace(requestId: string, pipelineVersion: "v1" | "v2"): PipelineTrace {
  return {
    requestId,
    runId: makeRunId("run"),
    pipelineVersion,
    stages: [],
  };
}

export function timedStage<T>(
  trace: PipelineTrace,
  stage: StageName,
  fn: () => Promise<T>,
  details: Record<string, unknown> = {},
) {
  const startedAtMs = Date.now();
  return fn()
    .then((result) => {
      const finishedAtMs = Date.now();
      trace.stages.push({
        stage,
        startedAtMs,
        finishedAtMs,
        elapsedMs: finishedAtMs - startedAtMs,
        details,
      });
      return result;
    })
    .catch((error) => {
      const finishedAtMs = Date.now();
      trace.stages.push({
        stage,
        startedAtMs,
        finishedAtMs,
        elapsedMs: finishedAtMs - startedAtMs,
        details: {
          ...details,
          failed: true,
          message: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    });
}

export function emitTrace(trace: PipelineTrace, meta: Record<string, unknown> = {}) {
  logger.info("RAG_V2_TRACE", {
    requestId: trace.requestId,
    runId: trace.runId,
    pipelineVersion: trace.pipelineVersion,
    stages: trace.stages.map((row) => ({
      stage: row.stage,
      elapsedMs: row.elapsedMs,
      ...(row.details || {}),
    })),
    ...meta,
  });
}
