import type { ConversationMessage } from "@/core/assistant/pipeline/pipeline-context";

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function tokenize(value: string) {
  return normalize(value)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 3);
}

function scoreByOverlap(referenceText: string, candidateText: string) {
  const ref = new Set(tokenize(referenceText));
  const candidate = tokenize(candidateText);
  if (!ref.size || !candidate.length) return 0;
  let overlap = 0;
  for (const token of candidate) {
    if (ref.has(token)) overlap += 1;
  }
  return overlap / Math.max(1, ref.size);
}

export class ShortTermContextProvider {
  normalizeHistory(history: ConversationMessage[] | undefined, maxItems = 12) {
    const rows = Array.isArray(history) ? history : [];
    if (rows.length <= maxItems) return rows;
    return rows.slice(rows.length - maxItems);
  }

  selectRelevantWindow(history: ConversationMessage[] | undefined, userMessage: string, maxItems = 8) {
    const rows = Array.isArray(history) ? history : [];
    if (!rows.length) return [];
    if (rows.length <= maxItems) return rows;

    const scored = rows.map((row, idx) => ({
      row,
      idx,
      score: scoreByOverlap(userMessage, row.content),
    }));
    const byScore = [...scored]
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.idx - a.idx;
      })
      .slice(0, maxItems)
      .sort((a, b) => a.idx - b.idx)
      .map((entry) => entry.row);

    if (byScore.length >= maxItems) return byScore;
    const lastRows = rows.slice(rows.length - maxItems);
    const merged = [...new Set([...lastRows, ...byScore])];
    return merged.slice(-maxItems);
  }
}
