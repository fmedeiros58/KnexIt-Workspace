import type { BibliographicEntry } from "../presentation-contracts";

function normalize(value: string) {
  return `${value || ""}`
    .trim()
    .replace(/\s+/g, " ");
}

function extractSurname(author: string) {
  const normalized = normalize(author);
  if (!normalized) return "";
  const chunks = normalized.split(" ").filter(Boolean);
  if (!chunks.length) return "";
  return chunks[chunks.length - 1].replace(/[^A-Za-zÀ-ÖØ-öø-ÿ-]/g, "").toUpperCase();
}

function normalizeYear(value: string | undefined) {
  const year = normalize(value || "");
  if (!year) return "";
  const match = year.match(/\b(1[89]\d{2}|20\d{2}[a-z]?)\b/i);
  return match ? match[1].toLowerCase() : year;
}

function authorsForParenthetical(entry: BibliographicEntry) {
  const authors = (entry.authors || []).map((author) => extractSurname(author)).filter(Boolean);
  if (authors.length === 0) return "";
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]}; ${authors[1]}`;
  return `${authors[0]} *et al.*`;
}

function authorsForNarrative(entry: BibliographicEntry) {
  const authors = (entry.authors || []).map((author) => normalize(author)).filter(Boolean);
  if (!authors.length) return "";
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} e ${authors[1]}`;
  return `${authors[0]} *et al.*`;
}

export type AbntInlineCitationOptions = {
  narrative?: boolean;
  page?: string;
};

export function formatAbntInlineCitation(
  entry: BibliographicEntry,
  options: AbntInlineCitationOptions = {},
) {
  const year = normalizeYear(entry.year);
  const page = normalize(options.page || "");
  const pageClause = page ? `, p. ${page}` : "";

  if (options.narrative) {
    const author = authorsForNarrative(entry);
    if (!author && year) return `(${year}${pageClause})`;
    if (!author) return "";
    if (!year) return author;
    return `${author} (${year}${pageClause})`;
  }

  const authors = authorsForParenthetical(entry);
  if (!authors && year) return `(${year}${pageClause})`;
  if (!authors) return "";
  if (!year) return `(${authors}${pageClause})`;
  return `(${authors}, ${year}${pageClause})`;
}
