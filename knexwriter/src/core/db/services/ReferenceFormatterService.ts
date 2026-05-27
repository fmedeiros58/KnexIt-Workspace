import type {
  BibliographyStyle,
  CitationOccurrence,
  CitationStyle,
  ReferenceAuthor,
  ReferenceSource,
} from "../db.types";

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .map((word) => (word ? `${word[0].toUpperCase()}${word.slice(1)}` : word))
    .join(" ");
}

function formatAbntAuthor(author: ReferenceAuthor): string {
  if (author.institutionName) return author.institutionName.toUpperCase();
  const family = (author.familyName || author.personName || "").toUpperCase();
  const given = author.givenName || "";
  return given ? `${family}, ${given}` : family;
}

function formatApaAuthor(author: ReferenceAuthor): string {
  if (author.institutionName) return author.institutionName;
  const family = author.familyName || author.personName || "";
  const initials = (author.givenName || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}.`)
    .join(" ");
  return initials ? `${toTitleCase(family)}, ${initials}` : toTitleCase(family);
}

export class ReferenceFormatterService {
  formatReference(source: ReferenceSource, style: BibliographyStyle, authors: ReferenceAuthor[] = []): string {
    return style === "APA"
      ? this.formatApaReference(source, authors)
      : this.formatAbntReference(source, authors);
  }

  formatInTextCitation(
    citation: CitationOccurrence,
    source: ReferenceSource,
    style: CitationStyle,
    authors: ReferenceAuthor[] = [],
  ): string {
    const firstAuthor = authors[0];
    const firstFamily = firstAuthor
      ? (firstAuthor.familyName || firstAuthor.personName || source.title)
      : source.title;

    const buildAbntAuthorSegment = (): string => {
      if (authors.length === 0) return source.title.toUpperCase();
      if (authors.length === 1) return firstFamily.toUpperCase();
      if (authors.length <= 3) {
        return authors
          .map((author) => (author.familyName || author.personName || "").toUpperCase())
          .filter(Boolean)
          .join("; ");
      }
      return `${firstFamily.toUpperCase()} et al.`;
    };

    const buildApaAuthorSegment = (): string => {
      if (authors.length === 0) return source.title;
      if (authors.length === 1) return toTitleCase(firstFamily);
      if (authors.length === 2) {
        const second = authors[1];
        const secondFamily = second.familyName || second.personName || "";
        return `${toTitleCase(firstFamily)} & ${toTitleCase(secondFamily)}`;
      }
      return `${toTitleCase(firstFamily)} et al.`;
    };

    if (style === "APA") {
      const authorLabel = buildApaAuthorSegment();
      return `(${authorLabel}, ${source.year ?? "n.d."})`;
    }

    const authorLabel = buildAbntAuthorSegment();
    const pagePart = citation.page ? `, p. ${citation.page}` : "";
    return `(${authorLabel}, ${source.year ?? "s. d."}${pagePart})`;
  }

  formatFootnote(citation: CitationOccurrence, source: ReferenceSource, style: CitationStyle): string {
    const pagePart = citation.page ? `, p. ${citation.page}` : "";
    if (style === "APA") {
      return `${source.title} (${source.year ?? "n.d."})${pagePart}.`;
    }
    return `${source.title}. ${source.year ?? "s. d."}${pagePart}.`;
  }

  formatBibliographyList(
    references: Array<{ source: ReferenceSource; authors: ReferenceAuthor[] }>,
    style: BibliographyStyle,
  ): string[] {
    return references
      .map(({ source, authors }) => this.formatReference(source, style, authors))
      .filter(Boolean);
  }

  private formatAbntReference(source: ReferenceSource, authors: ReferenceAuthor[]): string {
    const authorText = authors.length > 0
      ? authors.map(formatAbntAuthor).join("; ")
      : source.institution || source.title.toUpperCase();
    const titleText = source.subtitle ? `${source.title}: ${source.subtitle}` : source.title;
    const editionText = source.edition ? `${source.edition}. ed.` : "";
    const placePublisher = [source.place || "[S. l.]", source.publisher || "[s. n.]"].join(": ");
    const yearText = source.year || "s. d.";
    const onlineText = source.url
      ? ` Disponível em: ${source.url}. Acesso em: ${source.accessDate || "s. d."}.`
      : "";

    return `${authorText}. ${titleText}. ${editionText} ${placePublisher}, ${yearText}.${onlineText}`.replace(/\s+/g, " ").trim();
  }

  private formatApaReference(source: ReferenceSource, authors: ReferenceAuthor[]): string {
    const authorText = authors.length > 0
      ? authors.map(formatApaAuthor).join(", ")
      : source.institution || source.title;
    const titleText = source.subtitle ? `${source.title}: ${source.subtitle}` : source.title;
    const yearText = source.year || "n.d.";
    const sourceText = source.publisher || source.institution || "";
    const doiOrUrl = source.doi ? `https://doi.org/${source.doi}` : source.url || "";

    return `${authorText}. (${yearText}). ${titleText}. ${sourceText}${doiOrUrl ? ` ${doiOrUrl}` : ""}`.replace(/\s+/g, " ").trim();
  }
}
