/**
 * Responsabilidade do arquivo:
 * - Fornecer utilitarios de normalizacao para grounding deliberativo.
 * - Evitar duplicacao de snippets e IDs instaveis entre adaptadores.
 * - Garantir consistencia de score e higiene textual.
 */
import type { GroundedEvidenceItem } from "./grounded-evidence-packet";

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function normalizeGroundingText(value: string, maxChars = 380) {
  const clean = `${value || ""}`.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(80, maxChars - 3)).trimEnd()}...`;
}

export function normalizeGroundingFingerprint(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreLexicalAffinity(query: string, text: string) {
  const queryTokens = new Set(normalizeGroundingFingerprint(query).split(" ").filter(Boolean));
  if (!queryTokens.size) return 0;
  const textTokens = new Set(normalizeGroundingFingerprint(text).split(" ").filter(Boolean));
  if (!textTokens.size) return 0;
  let overlap = 0;
  for (const token of queryTokens) {
    if (textTokens.has(token)) overlap += 1;
  }
  return clamp01(overlap / Math.max(2, queryTokens.size));
}

export function dedupeGroundedItems(items: GroundedEvidenceItem[]) {
  const seen = new Set<string>();
  const output: GroundedEvidenceItem[] = [];
  for (const item of items) {
    const fp = normalizeGroundingFingerprint([item.stance, item.title, item.snippet, item.url].join(" "));
    if (!fp || seen.has(fp)) continue;
    seen.add(fp);
    output.push({
      ...item,
      snippet: normalizeGroundingText(item.snippet),
      score: clamp01(item.score),
      tags: Array.from(new Set((item.tags || []).filter(Boolean))),
    });
  }
  return output;
}

