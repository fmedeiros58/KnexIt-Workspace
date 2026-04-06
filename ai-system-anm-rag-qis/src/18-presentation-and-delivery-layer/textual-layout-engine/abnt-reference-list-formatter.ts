import type { BibliographicEntry } from "../presentation-contracts";

type FormatterOptions = {
  markdown?: boolean;
};

function normalize(value: string) {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

function cleanNonEmpty(parts: Array<string | undefined | null>) {
  return parts.map((part) => normalize(part || "")).filter(Boolean);
}

function boldTitle(title: string, subtitle: string, options: FormatterOptions) {
  const main = normalize(title);
  const sub = normalize(subtitle);
  if (!main && !sub) return "";
  const boldWrapped = options.markdown !== false ? `**${main}**` : `**${main}**`;
  if (!main) return sub;
  if (!sub) return boldWrapped;
  return `${boldWrapped}: ${sub}`;
}

function italicize(value: string, options: FormatterOptions) {
  const normalized = normalize(value);
  if (!normalized) return "";
  return options.markdown !== false ? `*${normalized}*` : `*${normalized}*`;
}

function splitAuthor(author: string) {
  const normalized = normalize(author);
  if (!normalized) return "";
  if (/,/.test(normalized)) return normalized;
  const chunks = normalized.split(" ").filter(Boolean);
  if (!chunks.length) return "";
  const surname = chunks[chunks.length - 1].toUpperCase();
  const names = chunks.slice(0, -1).join(" ");
  return names ? `${surname}, ${names}` : surname;
}

function authorSortToken(author: string) {
  const normalized = splitAuthor(author);
  if (!normalized) return "";
  const surname = normalize(normalized.split(",")[0] || "");
  if (surname) return surname;
  const chunks = normalize(author).split(" ").filter(Boolean);
  return (chunks[chunks.length - 1] || "").toUpperCase();
}

function formatAuthors(entry: BibliographicEntry) {
  const authors = (entry.authors || []).map((author) => splitAuthor(author)).filter(Boolean);
  if (!authors.length) return "";
  return authors.join("; ");
}

function formatYear(value: string | undefined) {
  const year = normalize(value || "");
  if (!year) return "";
  const match = year.match(/\b(1[89]\d{2}|20\d{2}[a-z]?)\b/i);
  return match ? match[1].toLowerCase() : year;
}

function formatBook(entry: BibliographicEntry, options: FormatterOptions) {
  const authors = formatAuthors(entry);
  const title = boldTitle(entry.title || "", entry.subtitle || "", options);
  const edition = normalize(entry.edition || "");
  const place = normalize(entry.place || "");
  const publisher = normalize(entry.publisher || "");
  const year = formatYear(entry.year);

  const parts = cleanNonEmpty([
    authors ? `${authors}.` : "",
    title ? `${title}.` : "",
    edition ? `${edition}.` : "",
    place && publisher ? `${place}: ${publisher},` : place ? `${place},` : publisher ? `${publisher},` : "",
    year ? `${year}.` : "",
  ]);
  return parts.join(" ");
}

function formatArticle(entry: BibliographicEntry, options: FormatterOptions) {
  const authors = formatAuthors(entry);
  const title = boldTitle(entry.title || "", entry.subtitle || "", options);
  const journal = italicize(entry.journal || "", options);
  const place = normalize(entry.place || "");
  const volume = normalize(entry.volume || "");
  const issue = normalize(entry.issue || "");
  const pages = normalize(entry.pages || "");
  const year = formatYear(entry.year);

  const parts = cleanNonEmpty([
    authors ? `${authors}.` : "",
    title ? `${title}.` : "",
    journal ? `${journal},` : "",
    place ? `${place},` : "",
    volume ? `v. ${volume},` : "",
    issue ? `n. ${issue},` : "",
    pages ? `p. ${pages},` : "",
    year ? `${year}.` : "",
  ]);
  return parts.join(" ");
}

function formatThesis(entry: BibliographicEntry, options: FormatterOptions) {
  const authors = formatAuthors(entry);
  const title = boldTitle(entry.title || "", entry.subtitle || "", options);
  const year = formatYear(entry.year);
  const place = normalize(entry.place || "");
  const publisher = normalize(entry.publisher || "");
  const typeLabel = normalize(entry.sourceType || "") === "thesis" ? "Tese" : "Dissertação";

  const parts = cleanNonEmpty([
    authors ? `${authors}.` : "",
    title ? `${title}.` : "",
    year ? `${year}.` : "",
    publisher ? `${typeLabel} (${publisher})` : typeLabel,
    place ? `– ${place},` : "",
    year ? `${year}.` : "",
  ]);
  return parts.join(" ");
}

function formatWebsite(entry: BibliographicEntry, options: FormatterOptions) {
  const authors = formatAuthors(entry);
  const title = boldTitle(entry.title || "", entry.subtitle || "", options);
  const place = normalize(entry.place || "");
  const publisher = normalize(entry.publisher || "");
  const year = formatYear(entry.year);
  const url = normalize(entry.url || "");
  const accessDate = normalize(entry.accessDate || "");
  const doi = normalize(entry.doi || "");

  const parts = cleanNonEmpty([
    authors ? `${authors}.` : "",
    title ? `${title}.` : "",
    place && publisher ? `${place}: ${publisher},` : place ? `${place},` : publisher ? `${publisher},` : "",
    year ? `${year}.` : "",
    doi ? `DOI: ${doi}.` : "",
    url ? `Disponível em: ${url}.` : "",
    accessDate ? `Acesso em: ${accessDate}.` : "",
  ]);
  return parts.join(" ");
}

export function formatAbntReferenceEntry(entry: BibliographicEntry, options: FormatterOptions = {}) {
  const sourceType = normalize(entry.sourceType || "unknown");
  if (sourceType === "book" || sourceType === "chapter") return formatBook(entry, options);
  if (sourceType === "article" || entry.journal) return formatArticle(entry, options);
  if (sourceType === "thesis" || /dissert|tese/i.test(normalize(entry.publisher || ""))) {
    return formatThesis(entry, options);
  }
  if (sourceType === "website" || entry.url) return formatWebsite(entry, options);
  return formatBook(entry, options);
}

function referenceSortKey(entry: BibliographicEntry) {
  const firstAuthor = authorSortToken((entry.authors || [])[0] || "");
  const title = normalize(entry.title || "");
  const base = firstAuthor || title || normalize(entry.url || "");
  return base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export function formatAbntReferenceList(entries: BibliographicEntry[], options: FormatterOptions = {}) {
  const sorted = [...(entries || [])].sort((a, b) => {
    const keyA = referenceSortKey(a);
    const keyB = referenceSortKey(b);
    return keyA.localeCompare(keyB, "pt-BR");
  });

  const list: string[] = [];
  for (const entry of sorted) {
    const line = formatAbntReferenceEntry(entry, options);
    if (!line) continue;
    if (list.includes(line)) continue;
    list.push(line);
  }
  return list;
}
