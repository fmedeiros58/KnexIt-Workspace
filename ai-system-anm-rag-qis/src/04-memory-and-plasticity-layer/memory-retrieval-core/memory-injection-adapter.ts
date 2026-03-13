import type { MemoryRecord } from "../../shared/types/memory-types";

export interface MemoryInjectionAdapterInput {
  existingRecords: MemoryRecord[];
  contextualized: Array<{ id: string; content: string; relevance: number }>;
}

export interface MemoryInjectionAdapterOutput {
  records: MemoryRecord[];
  selectedIds: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function memoryInjectionAdapter(input: MemoryInjectionAdapterInput): MemoryInjectionAdapterOutput {
  const nowIso = new Date().toISOString();
  const fromContextualized: MemoryRecord[] = input.contextualized.map((item) => ({
    id: item.id,
    kind: "working",
    content: item.content,
    relevance: item.relevance,
    createdAt: nowIso,
  }));

  const merged = [...input.existingRecords, ...fromContextualized]
    .reduce<MemoryRecord[]>((acc, item) => {
      if (acc.some((existing) => existing.id === item.id)) return acc;
      acc.push(item);
      return acc;
    }, [])
    .slice(-24);

  const selectedIds = input.contextualized.map((item) => item.id);
  const avgRelevance = fromContextualized.length
    ? fromContextualized.reduce((sum, item) => sum + item.relevance, 0) / fromContextualized.length
    : 0;

  return {
    records: merged,
    selectedIds,
    ok: true,
    component: "memory-injection-adapter",
    score: Number(avgRelevance.toFixed(4)),
    detail: `merged=${merged.length}`,
    context: {
      selectedIds,
      existingRecords: input.existingRecords.length,
    },
  };
}
