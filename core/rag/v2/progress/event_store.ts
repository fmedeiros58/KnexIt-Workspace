import type { RagPipelineProgressEvent } from "@/core/rag/v2/progress/types";

type ProgressEventListener = (event: RagPipelineProgressEvent) => void;

type RunBucket = {
  createdAt: number;
  updatedAt: number;
  events: RagPipelineProgressEvent[];
  listeners: Set<ProgressEventListener>;
};

const MAX_EVENTS_PER_RUN = 512;
const MAX_RUNS = 256;

function getGlobalStoreRef() {
  const root = globalThis as {
    __ragV2ProgressStore?: ProgressEventStore;
  };
  if (!root.__ragV2ProgressStore) {
    root.__ragV2ProgressStore = new ProgressEventStore();
  }
  return root.__ragV2ProgressStore;
}

export class ProgressEventStore {
  private readonly buckets = new Map<string, RunBucket>();

  private ensureRun(runId: string) {
    const safeRunId = `${runId || ""}`.trim();
    if (!safeRunId) return null;

    const existing = this.buckets.get(safeRunId);
    if (existing) return existing;

    if (this.buckets.size >= MAX_RUNS) {
      // Remove run mais antigo para manter memoria previsivel.
      let oldestKey = "";
      let oldestCreatedAt = Number.POSITIVE_INFINITY;
      for (const [key, row] of this.buckets.entries()) {
        if (row.createdAt < oldestCreatedAt) {
          oldestCreatedAt = row.createdAt;
          oldestKey = key;
        }
      }
      if (oldestKey) this.buckets.delete(oldestKey);
    }

    const created: RunBucket = {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      events: [],
      listeners: new Set<ProgressEventListener>(),
    };
    this.buckets.set(safeRunId, created);
    return created;
  }

  append(event: RagPipelineProgressEvent) {
    const bucket = this.ensureRun(event.run_id);
    if (!bucket) return;
    bucket.updatedAt = Date.now();
    bucket.events.push(event);
    if (bucket.events.length > MAX_EVENTS_PER_RUN) {
      bucket.events.splice(0, bucket.events.length - MAX_EVENTS_PER_RUN);
    }
    for (const listener of bucket.listeners) {
      try {
        listener(event);
      } catch {
        // best effort
      }
    }
  }

  list(runId: string, opts?: { limit?: number; afterElapsedMs?: number }) {
    const bucket = this.buckets.get(`${runId || ""}`.trim());
    if (!bucket) return [] as RagPipelineProgressEvent[];

    const afterElapsedMs = Number(opts?.afterElapsedMs);
    const filtered = Number.isFinite(afterElapsedMs)
      ? bucket.events.filter((row) => row.elapsed_ms > Math.max(0, Math.trunc(afterElapsedMs)))
      : bucket.events;

    const limit = Number(opts?.limit);
    if (!Number.isFinite(limit) || limit <= 0) return [...filtered];
    const safeLimit = Math.max(1, Math.min(5000, Math.trunc(limit)));
    return filtered.slice(Math.max(0, filtered.length - safeLimit));
  }

  latest(runId: string) {
    const bucket = this.buckets.get(`${runId || ""}`.trim());
    if (!bucket || bucket.events.length <= 0) return null;
    return bucket.events[bucket.events.length - 1] || null;
  }

  subscribe(runId: string, listener: ProgressEventListener) {
    const bucket = this.ensureRun(runId);
    if (!bucket) return () => undefined;
    bucket.listeners.add(listener);
    return () => {
      bucket.listeners.delete(listener);
    };
  }
}

export const progressEventStore = getGlobalStoreRef();
