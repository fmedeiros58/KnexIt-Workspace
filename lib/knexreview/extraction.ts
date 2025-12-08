import type { ExtractionRecord } from "./types";

// In-memory helper; TODO: persist in Supabase.
export function saveExtraction(records: ExtractionRecord[], input: ExtractionRecord): ExtractionRecord[] {
  const idx = records.findIndex((r) => r.recordId === input.recordId);
  if (idx >= 0) {
    const next = [...records];
    next[idx] = { ...input, updatedAt: new Date().toISOString() };
    return next;
  }
  return [...records, { ...input, updatedAt: new Date().toISOString() }];
}

