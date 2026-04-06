import { classifySourceKind, collapseWhitespace } from "../presentation-contracts";
import type { BibliographicEntry, CitationRequestContext, CitationView } from "../presentation-contracts";
import type { RetrievedSource } from "../../bridges/contracts/processing-state";
import { formatAbntInlineCitation } from "../textual-layout-engine/abnt-citation-style";
import { formatAbntReferenceEntry } from "../textual-layout-engine/abnt-reference-list-formatter";

export interface CitationAdapterInput {
  sources: RetrievedSource[];
  maxCitations?: number;
  requestContext?: CitationRequestContext;
  accessDate?: string;
}

export interface CitationAdapterOutput {
  ok: boolean;
  component: string;
  score: number;
  citations: CitationView[];
  referenceEntries: BibliographicEntry[];
  referenceList: string[];
}

function normalize(value: string) {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

function extractYear(value: string) {
  const match = normalize(value).match(/\b(1[89]\d{2}|20\d{2}[a-z]?)\b/i);
  return match ? match[1].toLowerCase() : "";
}

function extractAuthorsFromText(value: string) {
  const normalized = normalize(value);
  if (!normalized) return [];

  const explicitMatch = normalized.match(/\b(?:autor(?:es)?|authors?)\s*:\s*([^.;]+)/i);
  if (explicitMatch?.[1]) {
    return explicitMatch[1]
      .split(/;/g)
      .map((author) => normalize(author))
      .filter((author) => author.split(" ").length >= 2);
  }

  const prefixMatch = normalized.match(
    /^([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ'`-]+,\s*[A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ'`-]+(?:\s*;\s*[A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ'`-]+,\s*[A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ'`-]+)*)/,
  );
  if (!prefixMatch?.[1]) return [];
  return prefixMatch[1]
    .split(/\s*;\s*/g)
    .map((author) => normalize(author))
    .filter(Boolean);
}

function inferSourceType(url: string): BibliographicEntry["sourceType"] {
  const normalized = `${url || ""}`.toLowerCase();
  if (!normalized) return "unknown";
  if (/\b(pdf|thesis|dissert|repositorio|repository)\b/.test(normalized)) return "thesis";
  if (/\b(journal|revista|doi|article)\b/.test(normalized)) return "article";
  if (/^https?:\/\//.test(normalized)) return "website";
  return "unknown";
}

function toBibliographicEntry(source: RetrievedSource, accessDate: string): BibliographicEntry {
  const title = collapseWhitespace(source.title || "");
  const snippet = collapseWhitespace(source.snippet || "");
  const extractedYear = extractYear(`${title} ${snippet}`);
  const authors = extractAuthorsFromText(`${title}. ${snippet}`);
  return {
    authors: authors.length ? authors : undefined,
    title: title || undefined,
    year: extractedYear || undefined,
    url: source.url || undefined,
    accessDate: accessDate || undefined,
    sourceType: inferSourceType(source.url),
  };
}

export function citationAdapter(input: CitationAdapterInput): CitationAdapterOutput {
  const maxCitations = Number.isFinite(input.maxCitations)
    ? Math.max(1, Math.trunc(input.maxCitations as number))
    : 8;
  const deduped = new Map<string, CitationView>();
  const referenceEntries: BibliographicEntry[] = [];
  const referenceList: string[] = [];
  const context: CitationRequestContext = input.requestContext || {
    citationStyle: "default",
    referenceListStyle: "default",
    isAcademicMode: false,
    requestedInlineCitation: false,
    requestedReferenceList: false,
  };
  const accessDate = normalize(input.accessDate || "");

  for (const source of input.sources || []) {
    const url = `${source.url || ""}`.trim();
    if (!url || deduped.has(url)) continue;
    const kind = classifySourceKind(url);
    const bibliographicEntry = toBibliographicEntry(source, accessDate);
    const inlineCitation =
      context.citationStyle === "abnt" && context.requestedInlineCitation
        ? formatAbntInlineCitation(bibliographicEntry)
        : undefined;
    const referenceText =
      context.referenceListStyle === "abnt" && context.requestedReferenceList
        ? formatAbntReferenceEntry(bibliographicEntry, { markdown: true })
        : undefined;

    deduped.set(url, {
      url,
      title: collapseWhitespace(source.title || "fonte"),
      snippet: collapseWhitespace(source.snippet || ""),
      freshnessScore: Number.isFinite(source.freshnessScore) ? Number(source.freshnessScore) : 0,
      trustHint: kind === "web" ? "verified" : "unverified",
      inlineCitation,
      referenceText,
      bibliographicEntry,
    });
    referenceEntries.push(bibliographicEntry);
    if (referenceText && !referenceList.includes(referenceText)) {
      referenceList.push(referenceText);
    }

    if (deduped.size >= maxCitations) break;
  }

  const citations = [...deduped.values()];
  const verifiedRatio = citations.length
    ? citations.filter((row) => row.trustHint === "verified").length / citations.length
    : 0;

  return {
    ok: true,
    component: "citation-adapter",
    score: Math.max(0.4, Math.min(0.96, 0.55 + verifiedRatio * 0.35)),
    citations,
    referenceEntries,
    referenceList,
  };
}
