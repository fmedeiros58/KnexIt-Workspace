export type ProgressStage =
  | "idle"
  | "ingest"
  | "language"
  | "intent"
  | "genre"
  | "retrieval"
  | "memory"
  | "plan"
  | "compose"
  | "postprocess"
  | "done";

export type ProgressSignals = {
  ingested: boolean;
  intentDetected: boolean;
  usedRag: boolean;
  readFiles: boolean;
  loadedState: boolean;
  updatedState: boolean;
  planned: boolean;
  composed: boolean;
  filteredRedundancy: boolean;
  stage?: ProgressStage;
};

export function createDefaultProgressSignals(): ProgressSignals {
  return {
    ingested: false,
    intentDetected: false,
    usedRag: false,
    readFiles: false,
    loadedState: false,
    updatedState: false,
    planned: false,
    composed: false,
    filteredRedundancy: false,
    stage: "idle",
  };
}
