import type { BibliographicSource } from "../core/BibliographicSource";
import type { ReferenceStyle } from "../core/ReferenceStyle";
import { removeDiacritics } from "../utils/stringCase";

function primaryKey(source: BibliographicSource): string {
  const firstAuthor = source.authors?.[0];
  const authorToken =
    firstAuthor?.familyName
    || firstAuthor?.literal
    || source.organizationAuthor
    || source.title
    || "";
  return removeDiacritics(authorToken).toLowerCase();
}

function yearKey(source: BibliographicSource): string {
  return source.publicationDate?.year || "0000";
}

export function sortBibliography(references: BibliographicSource[], _style: ReferenceStyle): BibliographicSource[] {
  return [...references].sort((left, right) => {
    const authorOrder = primaryKey(left).localeCompare(primaryKey(right), "pt-BR");
    if (authorOrder !== 0) return authorOrder;
    const yearOrder = yearKey(left).localeCompare(yearKey(right), "pt-BR");
    if (yearOrder !== 0) return yearOrder;
    return (left.title || "").localeCompare(right.title || "", "pt-BR");
  });
}

