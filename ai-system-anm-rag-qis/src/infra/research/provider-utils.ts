import type { ResearchDocument } from "./research-types";

export function normalizeText(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanText(value: string, max = 320): string {
  const cleaned = `${value || ""}`
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, decimal) => {
      const code = Number(decimal);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}...`;
}

export function computeKeywordRelevance(query: string, title: string, snippet: string): number {
  const queryTokens = new Set(normalizeText(query).split(" ").filter(Boolean));
  const docTokens = new Set(normalizeText(`${title} ${snippet}`).split(" ").filter(Boolean));

  if (!queryTokens.size || !docTokens.size) return 0.42;

  let overlap = 0;
  for (const token of queryTokens) {
    if (docTokens.has(token)) overlap += 1;
  }

  const ratio = overlap / queryTokens.size;
  return Math.max(0.35, Math.min(0.98, 0.35 + ratio * 0.63));
}

export function dedupeResearchDocuments(docs: ResearchDocument[], maxResults: number): ResearchDocument[] {
  const byKey = new Map<string, ResearchDocument>();

  for (const doc of docs) {
    const key = `${doc.doi || ""}|${doc.pmid || ""}|${doc.arxivId || ""}|${doc.url || ""}|${doc.title || ""}`
      .toLowerCase()
      .trim();

    if (!key) continue;

    if (!byKey.has(key)) {
      byKey.set(key, doc);
      continue;
    }

    const existing = byKey.get(key)!;
    const existingScore =
      `${existing.title} ${existing.snippet}`.length +
      (existing.relevanceScore || 0) * 100 +
      (existing.trustScore || 0) * 100;

    const currentScore =
      `${doc.title} ${doc.snippet}`.length + (doc.relevanceScore || 0) * 100 + (doc.trustScore || 0) * 100;

    if (currentScore > existingScore) {
      byKey.set(key, doc);
    }
  }

  return Array.from(byKey.values())
    .sort((a, b) => {
      const ra = (a.relevanceScore || 0) + (a.trustScore || 0) + (a.freshnessScore || 0);
      const rb = (b.relevanceScore || 0) + (b.trustScore || 0) + (b.freshnessScore || 0);
      return rb - ra;
    })
    .slice(0, maxResults);
}

export function computeSourceTrustByType(sourceType: string): number {
  if (sourceType === "pubmed") return 0.97;
  if (sourceType === "crossref") return 0.95;
  if (sourceType === "openalex") return 0.94;
  if (sourceType === "arxiv") return 0.88;
  if (sourceType === "wikipedia") return 0.76;
  if (sourceType === "local_factual_db") return 0.93;
  if (sourceType === "local_vector_db") return 0.84;
  if (sourceType === "local_library") return 0.91;
  if (sourceType === "web") return 0.72;
  return 0.6;
}

export function computeFreshnessScore(dateLike?: string): number {
  if (!dateLike) return 0.45;

  const timestamp = Date.parse(dateLike);
  if (!Number.isFinite(timestamp)) return 0.45;

  const ageDays = Math.max(0, (Date.now() - timestamp) / (1000 * 60 * 60 * 24));

  if (ageDays <= 7) return 0.97;
  if (ageDays <= 30) return 0.92;
  if (ageDays <= 90) return 0.84;
  if (ageDays <= 180) return 0.76;
  if (ageDays <= 365) return 0.68;
  if (ageDays <= 365 * 2) return 0.58;
  return 0.48;
}
