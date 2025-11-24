import type { SearchResultRecord } from "./types";

export function deduplicate(records: SearchResultRecord[]): SearchResultRecord[] {
  const seen = new Map<string, SearchResultRecord>();
  const normalize = (s?: string) => (s || "").trim().toLowerCase();
  for (const rec of records) {
    const key = rec.doi ? normalize(rec.doi) : `${normalize(rec.title)}-${rec.year || ""}`;
    if (!seen.has(key)) {
      seen.set(key, rec);
    }
  }
  return Array.from(seen.values());
}

