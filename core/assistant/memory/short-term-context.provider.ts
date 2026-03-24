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

function isDocumentAnchorCandidate(value: string) {
  const normalized = normalize(value);
  if (!normalized) return false;
  return /\b(arquivo|documento|anexad|doc:\s*\d+|pdf|dissertacao|tese)\b/.test(normalized);
}

function isIdentityAnchorCandidate(value: string) {
  const normalized = normalize(value);
  if (!normalized) return false;
  return /\b(meu nome|me chame de|pode me chamar de|sou\s+[a-z]|preferred_name|nome preferido)\b/.test(normalized);
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
    const safeMaxItems = Math.max(1, Math.round(maxItems));
    if (rows.length <= safeMaxItems) return rows;

    // Sempre preserva recencia para evitar perda de continuidade em follow-ups.
    const recencyBudget =
      safeMaxItems === 1 ? 1 : Math.max(2, Math.min(safeMaxItems, Math.ceil(safeMaxItems * 0.6)));
    const recentStartIndex = Math.max(0, rows.length - recencyBudget);
    const selected = new Set<number>();
    for (let idx = recentStartIndex; idx < rows.length; idx += 1) {
      selected.add(idx);
    }

    // Preserva ancora documental (arquivo/doc) quando existir fora da janela recente.
    if (selected.size < safeMaxItems) {
      let anchorIndex = -1;
      for (let idx = recentStartIndex - 1; idx >= 0; idx -= 1) {
        if (!isDocumentAnchorCandidate(rows[idx]?.content || "")) continue;
        anchorIndex = idx;
        break;
      }
      if (anchorIndex >= 0) selected.add(anchorIndex);
    }

    // Preserva ancora de identidade (nome preferido) para manter continuidade pessoal do chat.
    if (selected.size < safeMaxItems) {
      let identityAnchorIndex = -1;
      for (let idx = recentStartIndex - 1; idx >= 0; idx -= 1) {
        if (!isIdentityAnchorCandidate(rows[idx]?.content || "")) continue;
        identityAnchorIndex = idx;
        break;
      }
      if (identityAnchorIndex >= 0) selected.add(identityAnchorIndex);
    }

    if (selected.size < safeMaxItems) {
      const candidates: Array<{ idx: number; score: number }> = [];
      for (let idx = 0; idx < rows.length; idx += 1) {
        if (selected.has(idx)) continue;
        candidates.push({
          idx,
          score: scoreByOverlap(userMessage, rows[idx]?.content || ""),
        });
      }
      candidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.idx - a.idx;
      });
      for (const candidate of candidates) {
        if (selected.size >= safeMaxItems) break;
        selected.add(candidate.idx);
      }
    }

    return Array.from(selected)
      .sort((a, b) => a - b)
      .map((idx) => rows[idx])
      .slice(-safeMaxItems);
  }
}
