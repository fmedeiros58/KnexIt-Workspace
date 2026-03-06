export type PipelineProgressEventType = "progress" | "metric" | "checkpoint" | "error" | "final";

export type PipelineProgressStage =
  | "INGEST"
  | "OCR"
  | "PARSE"
  | "STRUCTURE"
  | "CHUNK"
  | "EMBED"
  | "RETRIEVE"
  | "RERANK"
  | "PACK"
  | "DRAFT"
  | "CITE_AUDIT"
  | "MERGE"
  | "FINALIZE";

export type ProgressTarget = {
  doc_name?: string;
  doc_id?: string;
  chapter?: string;
  section?: string;
  page?: {
    current?: number;
    start?: number;
    end?: number;
    total?: number;
  };
  chunk?: {
    current?: number;
    total?: number;
  };
};

export type ProgressCounters = Record<string, number>;

export type RagPipelineProgressEvent = {
  type: PipelineProgressEventType;
  request_id: string;
  run_id: string;
  ts: string;
  elapsed_ms: number;
  stage: PipelineProgressStage;
  substage: string;
  target: ProgressTarget;
  progress_pct?: number;
  counters?: ProgressCounters;
  message: string;
  detail?: Record<string, unknown>;
};

export function createProgressTimestamp() {
  return new Date().toISOString();
}
