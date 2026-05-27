import type { BibliographicSource } from "../core/BibliographicSource";
import { formatFamilyNameForAbnt } from "../normalizers/normalizeAuthors";
import type { CitationInput, CitationOutput } from "./citationTypes";

function abntPrimarySurname(source: BibliographicSource): string {
  if (source.authors?.length) {
    const first = source.authors[0];
    const family = first.familyName || first.literal || first.givenNames || "AUTOR";
    return formatFamilyNameForAbnt(family);
  }
  if (source.organizationAuthor) return source.organizationAuthor.toUpperCase();
  return (source.title || "AUTOR").toUpperCase();
}

function buildAbntAuthorToken(source: BibliographicSource): string {
  if (!source.authors?.length) return abntPrimarySurname(source);
  if (source.authors.length === 1) return abntPrimarySurname(source);
  if (source.authors.length <= 3) {
    return source.authors
      .map((author) => formatFamilyNameForAbnt(author.familyName || author.literal || author.givenNames || "AUTOR"))
      .join("; ");
  }
  return `${abntPrimarySurname(source)} et al.`;
}

export function formatAbntCitation(source: BibliographicSource, input: CitationInput): CitationOutput {
  const year = source.publicationDate?.year || "s. d.";
  const authorToken = buildAbntAuthorToken(source);
  const locator = input.locator?.value ? `, p. ${input.locator.value}` : "";
  const citation =
    input.mode === "narrative"
      ? `${authorToken} (${year}${locator ? `${locator}` : ""})`
      : `(${authorToken}, ${year}${locator})`;

  return {
    citation,
    sourceId: source.id,
    style: "ABNT_NBR_6023_2018",
  };
}

