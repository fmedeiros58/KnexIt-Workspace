import type { BibliographicSource, PersonName } from "../../core/BibliographicSource";
import { formatAuthorAbnt } from "../../normalizers/normalizeAuthors";
import { formatDateForAbnt } from "../../normalizers/normalizeDate";
import { formatPagesRange } from "../../normalizers/normalizePages";
import { joinClean } from "../../utils/joinClean";
import { ensureTrailingPeriod } from "../../utils/punctuation";

export function formatAbntAuthors(source: BibliographicSource): string {
  const authors = source.authors || [];
  if (authors.length > 0) {
    return authors.map((author) => formatAuthorAbnt(author)).join("; ");
  }
  if (source.organizationAuthor) return source.organizationAuthor.toUpperCase();
  return source.title ? source.title : "AUTOR DESCONHECIDO";
}

export function formatAbntTitle(source: BibliographicSource): string {
  return source.subtitle ? `${source.title}: ${source.subtitle}` : source.title;
}

export function formatAbntEdition(source: BibliographicSource): string {
  const edition = source.edition?.trim();
  if (!edition) return "";
  return ensureTrailingPeriod(edition.toLowerCase().includes("ed.") ? edition : `${edition} ed.`);
}

export function formatAbntPlacePublisherYear(source: BibliographicSource): string {
  const place = source.place || "[S. l.]";
  const publisher = source.publisher || "[s. n.]";
  const year = source.publicationDate?.year || "s. d.";
  return `${place}: ${publisher}, ${year}.`;
}

export function formatAbntOnlineAccess(source: BibliographicSource): string {
  if (!source.url) return "";
  const access = source.accessDate ? ` Acesso em: ${formatDateForAbnt(source.accessDate)}.` : "";
  return `Disponível em: ${source.url}.${access}`;
}

export function formatAbntPages(source: BibliographicSource): string {
  const pages = formatPagesRange(source.pages);
  return pages ? `p. ${pages}` : "";
}

export function formatAbntContributors(contributors: PersonName[] | undefined, roleLabel: string): string {
  if (!contributors?.length) return "";
  return joinClean([roleLabel, contributors.map((person) => formatAuthorAbnt(person)).join("; ")], ": ");
}

