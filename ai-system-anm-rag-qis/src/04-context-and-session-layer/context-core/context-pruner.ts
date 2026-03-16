export interface ContextPrunerInput {
  query: string;
  contextItems: string[];
  maxItems?: number;
}

export interface ContextPrunerOutput {
  prunedContext: string[];
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

function overlapRatio(query: string, candidate: string) {
  const queryTokens = new Set(tokenize(query));
  const candidateTokens = new Set(tokenize(candidate));
  if (!queryTokens.size || !candidateTokens.size) return 0;
  const hits = [...queryTokens].filter((token) => candidateTokens.has(token)).length;
  return hits / queryTokens.size;
}

export function contextPruner(input: ContextPrunerInput): ContextPrunerOutput {
  const maxItems = Math.max(4, Math.min(14, input.maxItems ?? 10));
  const ranked = input.contextItems
    .map((item) => ({
      item,
      relevance: overlapRatio(input.query, item),
    }))
    .sort((a, b) => b.relevance - a.relevance);

  const selected = ranked.slice(0, maxItems).map((entry) => entry.item);
  const avg = ranked.length
    ? ranked.slice(0, maxItems).reduce((sum, entry) => sum + entry.relevance, 0) / Math.min(maxItems, ranked.length)
    : 0;

  return {
    prunedContext: selected,
    ok: true,
    component: "context-pruner",
    score: Number(avg.toFixed(4)),
    detail: `kept=${selected.length}`,
    context: {
      maxItems,
      originalSize: input.contextItems.length,
    },
  };
}
