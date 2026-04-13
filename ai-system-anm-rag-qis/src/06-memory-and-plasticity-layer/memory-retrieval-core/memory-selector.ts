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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeCandidateScore(candidate: MemoryCandidate): MemoryCandidate {
  const normalizedScore =
    typeof candidate.score === "number" && Number.isFinite(candidate.score)
      ? clamp01(candidate.score)
      : clamp01(candidate.relevance);

  const normalizedRelevance =
    typeof candidate.relevance === "number" && Number.isFinite(candidate.relevance)
      ? clamp01(candidate.relevance)
      : normalizedScore;

  return {
    ...candidate,
    score: Number(normalizedScore.toFixed(4)),
    relevance: Number(normalizedRelevance.toFixed(4)),
  };
}

function dedupeByIdKeepingBest(candidates: MemoryCandidate[]): MemoryCandidate[] {
  const index = new Map<string, MemoryCandidate>();

  for (const candidate of candidates) {
    const existing = index.get(candidate.id);
    if (!existing || candidate.score > existing.score) {
      index.set(candidate.id, candidate);
    }
  }

  return Array.from(index.values());
}

function sortByPriority(candidates: MemoryCandidate[]): MemoryCandidate[] {
  return [...candidates].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (right.relevance !== left.relevance) return right.relevance - left.relevance;

    const leftLength = left.content?.length || 0;
    const rightLength = right.content?.length || 0;
    return rightLength - leftLength;
  });
}

export function memorySelector(input: MemorySelectorInput): MemorySelectorOutput {
  const topK = Math.max(1, Math.min(12, input.topK ?? 5));
  const minScore = clamp01(input.minScore ?? 0.45);

  const normalizedCandidates = (input.prioritized || [])
    .map((candidate) => normalizeCandidateScore(candidate))
    .filter((candidate) => Boolean(candidate.id) && Boolean(candidate.content));

  const dedupedCandidates = dedupeByIdKeepingBest(normalizedCandidates);
  const orderedCandidates = sortByPriority(dedupedCandidates);

  const thresholdSelected = orderedCandidates
    .filter((candidate) => candidate.score >= minScore)
    .slice(0, topK);

  const fallbackSelected = thresholdSelected.length
    ? thresholdSelected
    : orderedCandidates.slice(0, Math.min(3, topK));

  const selectedIds = [...new Set(fallbackSelected.map((item) => item.id))];
  const averageScore = fallbackSelected.length
    ? fallbackSelected.reduce((sum, item) => sum + item.score, 0) / fallbackSelected.length
    : 0;

  return {
    selected: fallbackSelected,
    selectedIds,
    ok: true,
    component: "memory-selector",
    score: Number(averageScore.toFixed(4)),
    detail:
      `selected=${fallbackSelected.length}; thresholdMatches=${thresholdSelected.length}; ` +
      `deduped=${dedupedCandidates.length}`,
    context: {
      topK,
      minScore,
      selectedIds,
      inputCandidates: normalizedCandidates.length,
      dedupedCandidates: dedupedCandidates.length,
      thresholdMatches: thresholdSelected.length,
      fallbackUsed: thresholdSelected.length === 0,
    },
  };
}