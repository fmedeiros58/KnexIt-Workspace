import type { ScreeningRecord, ScreeningDecision, PrismaCounts } from "./types";

// In-memory helpers; TODO: persist in Supabase.
export function updateScreening(records: ScreeningRecord[], input: ScreeningRecord): ScreeningRecord[] {
  const idx = records.findIndex((r) => r.recordId === input.recordId);
  if (idx >= 0) {
    const next = [...records];
    next[idx] = { ...records[idx], ...input, decidedAt: new Date().toISOString() };
    return next;
  }
  return [...records, { ...input, decidedAt: new Date().toISOString() }];
}

export function summarizePrisma(decisions: ScreeningRecord[]): PrismaCounts {
  const included = decisions.filter((d) => d.decision === "include").length;
  const excluded = decisions.filter((d) => d.decision === "exclude").length;
  const maybe = decisions.filter((d) => d.decision === "maybe").length;
  return {
    identified: decisions.length,
    afterDedup: decisions.length,
    afterScreening: decisions.length - maybe,
    included,
  };
}

