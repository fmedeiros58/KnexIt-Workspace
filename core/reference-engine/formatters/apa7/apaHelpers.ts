import type { BibliographicSource } from "../../core/BibliographicSource";
import { formatAuthorApa } from "../../normalizers/normalizeAuthors";
import { formatDateForApa } from "../../normalizers/normalizeDate";
import { formatPagesRange } from "../../normalizers/normalizePages";
import { joinClean } from "../../utils/joinClean";
import { toSentenceCase } from "../../utils/stringCase";

export function formatApaAuthors(source: BibliographicSource): string {
  const authors = source.authors || [];
  if (authors.length > 0) {
    if (authors.length === 1) return formatAuthorApa(authors[0]);
    const formatted = authors.map((author) => formatAuthorApa(author));
    if (formatted.length === 2) return `${formatted[0]}, & ${formatted[1]}`;
    return `${formatted.slice(0, -1).join(", ")}, & ${formatted[formatted.length - 1]}`;
  }
  if (source.organizationAuthor) return source.organizationAuthor;
  return source.title || "Unknown author";
}

export function formatApaDate(source: BibliographicSource): string {
  return `(${formatDateForApa(source.publicationDate)})`;
}

export function formatApaTitle(source: BibliographicSource): string {
  const sentenceCaseTitle = toSentenceCase(source.title || "");
  if (!source.subtitle) return sentenceCaseTitle;
  return `${sentenceCaseTitle}: ${toSentenceCase(source.subtitle)}`;
}

export function formatApaDoiOrUrl(source: BibliographicSource): string {
  if (source.doi) return `https://doi.org/${source.doi}`;
  if (source.url) return source.url;
  return "";
}

export function formatApaPages(source: BibliographicSource): string {
  return formatPagesRange(source.pages);
}

export function formatApaContainerVolumeIssue(source: BibliographicSource): string {
  const volume = source.volume || "";
  const issue = source.issue || source.number || "";
  if (volume && issue) return `${volume}(${issue})`;
  return volume || issue;
}

export function formatApaThesisBracket(source: BibliographicSource): string {
  const workType = source.academicWork?.workType || source.type;
  const institution = source.academicWork?.institution || source.institution || "";
  const parts = joinClean([workType, institution], ", ");
  return parts ? `[${parts}]` : "";
}

