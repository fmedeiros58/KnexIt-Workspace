import type { BibliographicSource } from "../core/BibliographicSource";
import { removeDiacritics } from "../utils/stringCase";

function sourceKey(source: BibliographicSource): string {
  const mainAuthor = source.authors?.[0]?.familyName
    || source.authors?.[0]?.literal
    || source.organizationAuthor
    || source.title
    || "unknown";
  const year = source.publicationDate?.year || "n.d.";
  return `${removeDiacritics(mainAuthor).toLowerCase()}::${year}`;
}

export function disambiguateSameAuthorSameYear(references: BibliographicSource[]): BibliographicSource[] {
  const groups = new Map<string, BibliographicSource[]>();
  for (const reference of references) {
    const key = sourceKey(reference);
    const current = groups.get(key) || [];
    current.push(reference);
    groups.set(key, current);
  }

  const suffixes = "abcdefghijklmnopqrstuvwxyz";
  const output: BibliographicSource[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      output.push(group[0]);
      continue;
    }
    group.forEach((reference, index) => {
      const suffix = suffixes[index] || "z";
      output.push({
        ...reference,
        extra: {
          ...(reference.extra || {}),
          yearSuffix: suffix,
        },
      });
    });
  }
  return output;
}

