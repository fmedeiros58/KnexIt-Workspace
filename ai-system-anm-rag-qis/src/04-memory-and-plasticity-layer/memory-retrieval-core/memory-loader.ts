import type { MemoryRecord } from "../../shared/types/memory-types";

export interface MemoryCandidate extends MemoryRecord {
  source: "snapshot" | "context" | "turn";
  score: number;
}

export interface MemoryLoaderInput {
  existingRecords: MemoryRecord[];
  activeContext: string[];
  recentTurns: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface MemoryLoaderOutput {
  candidates: MemoryCandidate[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function makeId(prefix: string, value: string, index: number) {
  const base = `${prefix}-${index}-${value}`.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  return base.slice(0, 64);
}

export function memoryLoader(input: MemoryLoaderInput): MemoryLoaderOutput {
  const nowIso = new Date().toISOString();
  const snapshotCandidates: MemoryCandidate[] = input.existingRecords.map((record) => ({
    ...record,
    source: "snapshot",
    score: Math.max(0.05, Math.min(1, record.relevance)),
  }));

  const contextCandidates: MemoryCandidate[] = input.activeContext.slice(-6).map((content, index) => ({
    id: makeId("ctx", content, index),
    kind: "working",
    content,
    relevance: 0.58,
    createdAt: nowIso,
    source: "context",
    score: 0.58,
  }));

  const turnCandidates: MemoryCandidate[] = input.recentTurns.slice(-4).map((turn, index) => ({
    id: makeId("turn", turn.content, index),
    kind: turn.role === "user" ? "episodic" : "short-term",
    content: turn.content,
    relevance: turn.role === "user" ? 0.62 : 0.48,
    createdAt: nowIso,
    source: "turn",
    score: turn.role === "user" ? 0.62 : 0.48,
  }));

  const candidates = [...snapshotCandidates, ...contextCandidates, ...turnCandidates];
  const score = Math.min(1, 0.3 + (candidates.length * 0.05));

  return {
    candidates,
    ok: true,
    component: "memory-loader",
    score: Number(score.toFixed(4)),
    detail: `candidates=${candidates.length}`,
    context: {
      snapshot: snapshotCandidates.length,
      context: contextCandidates.length,
      turns: turnCandidates.length,
    },
  };
}
