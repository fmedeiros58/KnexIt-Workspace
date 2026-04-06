import { classifySourceKind, collapseWhitespace } from "../presentation-contracts";
import type { BibliographicEntry, CitationRequestContext, DocumentView } from "../presentation-contracts";
import type { RetrievedSource } from "../../bridges/contracts/processing-state";
import { formatAbntReferenceEntry } from "../textual-layout-engine/abnt-reference-list-formatter";

export interface DocumentBlockAdapterInput {
  sources: RetrievedSource[];
  maxDocuments?: number;
  requestContext?: CitationRequestContext;
  accessDate?: string;
}

export interface DocumentBlockAdapterOutput {
  ok: boolean;
  component: string;
  score: number;
  documents: DocumentView[];
}

function normalize(value: string) {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

function extractYear(value: string) {
  const match = normalize(value).match(/\b(1[89]\d{2}|20\d{2}[a-z]?)\b/i);
  return match ? match[1].toLowerCase() : "";
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
  return {
    title: title || undefined,
    year: extractYear(`${title} ${snippet}`) || undefined,
    url: source.url || undefined,
    accessDate: accessDate || undefined,
    sourceType: inferSourceType(source.url),
  };
}

export function documentBlockAdapter(input: DocumentBlockAdapterInput): DocumentBlockAdapterOutput {
  const maxDocuments = Number.isFinite(input.maxDocuments)
    ? Math.max(1, Math.trunc(input.maxDocuments as number))
    : 6;
  const context = input.requestContext || {
    citationStyle: "default" as const,
    referenceListStyle: "default" as const,
    isAcademicMode: false,
    requestedInlineCitation: false,
    requestedReferenceList: false,
  };
  const accessDate = normalize(input.accessDate || "");
  const documents: DocumentView[] = [];
  const seen = new Set<string>();

  for (const source of input.sources || []) {
    const sourcePath = `${source.url || ""}`.trim();
    if (!sourcePath || seen.has(sourcePath)) continue;
    seen.add(sourcePath);

    const bibliographicEntry = toBibliographicEntry(source, accessDate);
    const referenceText =
      context.referenceListStyle === "abnt" && context.requestedReferenceList
        ? formatAbntReferenceEntry(bibliographicEntry, { markdown: true })
        : undefined;

    documents.push({
      title: collapseWhitespace(source.title || "documento"),
      source: sourcePath,
      snippet: collapseWhitespace(source.snippet || "").slice(0, 280),
      kind: classifySourceKind(sourcePath),
      bibliographicEntry,
      referenceText,
    });
    if (documents.length >= maxDocuments) break;
  }

  return {
    ok: true,
    component: "document-block-adapter",
    score: documents.length ? 0.88 : 0.46,
    documents,
  };
}
