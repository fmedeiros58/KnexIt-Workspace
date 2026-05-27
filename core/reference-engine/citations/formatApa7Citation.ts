import type { BibliographicSource } from "../core/BibliographicSource";
import { toTitleCase } from "../utils/stringCase";
import type { CitationInput, CitationOutput } from "./citationTypes";

function apaPrimarySurname(source: BibliographicSource): string {
  if (source.authors?.length) {
    const first = source.authors[0];
    return toTitleCase(first.familyName || first.literal || first.givenNames || "Author");
  }
  if (source.organizationAuthor) return source.organizationAuthor;
  return source.title || "Author";
}

function buildApaAuthorToken(source: BibliographicSource): string {
  if (!source.authors?.length) return apaPrimarySurname(source);
  if (source.authors.length === 1) return apaPrimarySurname(source);
  if (source.authors.length === 2) {
    const first = toTitleCase(source.authors[0].familyName || source.authors[0].literal || source.authors[0].givenNames || "Author");
    const second = toTitleCase(source.authors[1].familyName || source.authors[1].literal || source.authors[1].givenNames || "Author");
    return `${first} & ${second}`;
  }
  return `${apaPrimarySurname(source)} et al.`;
}

export function formatApa7Citation(source: BibliographicSource, input: CitationInput): CitationOutput {
  const year = source.publicationDate?.year || "n.d.";
  const authorToken = buildApaAuthorToken(source);
  const locator = input.locator?.value ? `, p. ${input.locator.value}` : "";
  const citation =
    input.mode === "narrative"
      ? `${authorToken} (${year}${locator})`
      : `(${authorToken}, ${year}${locator})`;

  return {
    citation,
    sourceId: source.id,
    style: "APA_7",
  };
}

