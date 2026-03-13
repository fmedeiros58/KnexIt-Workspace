import type { MemoryCandidate } from "./memory-loader";

export interface MemoryPriorityWeigherInput {
  candidates: MemoryCandidate[];
  query: string;
}

export interface MemoryPriorityWeigherOutput {
  prioritized: MemoryCandidate[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter(Boolean);
}

function lexicalOverlap(query: string, content: string) {
  const queryTokens = new Set(tokenize(query));
  const contentTokens = new Set(tokenize(content));
  if (queryTokens.size === 0 || contentTokens.size === 0) return 0;
  const hits = [...queryTokens].filter((token) => contentTokens.has(token)).length;
  return hits / queryTokens.size;
}

export function memoryPriorityWeigher(input: MemoryPriorityWeigherInput): MemoryPriorityWeigherOutput {
  const prioritized = input.candidates
    .map((candidate) => {
      const overlap = lexicalOverlap(input.query, candidate.content);
      const sourceBoost =
        candidate.source === "snapshot" ? 0.08 :
        candidate.source === "context" ? 0.05 :
        0.03;
      const weighed = Math.max(0, Math.min(1, (candidate.score * 0.55) + (candidate.relevance * 0.25) + (overlap * 0.2) + sourceBoost));
      return {
        ...candidate,
        score: Number(weighed.toFixed(6)),
      };
    })
    .sort((a, b) => b.score - a.score);

  const averageScore = prioritized.length
    ? prioritized.reduce((sum, item) => sum + item.score, 0) / prioritized.length
    : 0;

  return {
    prioritized,
    ok: true,
    component: "memory-priority-weigher",
    score: Number(averageScore.toFixed(4)),
    detail: `prioritized=${prioritized.length}`,
    context: {
      averageScore: Number(averageScore.toFixed(4)),
    },
  };
}
