import type { MemoryCandidate } from "./memory-loader";

export interface MemoryContextualizerInput {
  query: string;
  selected: MemoryCandidate[];
}

export interface MemoryContextualizerOutput {
  contextualized: Array<{ id: string; content: string; relevance: number }>;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function compact(value: string, maxChars = 220) {
  const safe = value.replace(/\s+/g, " ").trim();
  if (safe.length <= maxChars) return safe;
  return `${safe.slice(0, maxChars - 1)}...`;
}

export function memoryContextualizer(input: MemoryContextualizerInput): MemoryContextualizerOutput {
  const contextualized = input.selected.map((item) => {
    const hasDirectOverlap = item.content.toLowerCase().includes(input.query.toLowerCase().split(/\s+/)[0] || "");
    const relevance = hasDirectOverlap ? Math.min(1, item.relevance + 0.08) : item.relevance;
    return {
      id: item.id,
      content: compact(item.content),
      relevance: Number(Math.max(0.05, Math.min(1, relevance)).toFixed(4)),
    };
  });

  const avg = contextualized.length
    ? contextualized.reduce((sum, item) => sum + item.relevance, 0) / contextualized.length
    : 0;

  return {
    contextualized,
    ok: true,
    component: "memory-contextualizer",
    score: Number(avg.toFixed(4)),
    detail: `contextualized=${contextualized.length}`,
    context: {
      queryLength: input.query.length,
    },
  };
}
