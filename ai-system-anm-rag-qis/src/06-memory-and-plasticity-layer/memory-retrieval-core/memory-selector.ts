import type { MemoryCandidate } from "./memory-loader";

export interface MemorySelectorInput {
  prioritized: MemoryCandidate[];
  topK?: number;
  minScore?: number;
}

export interface MemorySelectorOutput {
  selected: MemoryCandidate[];
  selectedIds: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function memorySelector(input: MemorySelectorInput): MemorySelectorOutput {
  const topK = Math.max(1, Math.min(12, input.topK ?? 5));
  const minScore = Math.max(0, Math.min(1, input.minScore ?? 0.45));

  const selected = input.prioritized
    .filter((candidate) => candidate.score >= minScore)
    .slice(0, topK);
  const fallback = selected.length ? selected : input.prioritized.slice(0, Math.min(3, topK));
  const selectedIds = fallback.map((item) => item.id);
  const averageScore = fallback.length
    ? fallback.reduce((sum, item) => sum + item.score, 0) / fallback.length
    : 0;

  return {
    selected: fallback,
    selectedIds,
    ok: true,
    component: "memory-selector",
    score: Number(averageScore.toFixed(4)),
    detail: `selected=${fallback.length}`,
    context: {
      topK,
      minScore,
      selectedIds,
    },
  };
}
