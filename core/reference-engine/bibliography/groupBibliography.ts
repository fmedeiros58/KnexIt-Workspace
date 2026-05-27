import type { BibliographicSource } from "../core/BibliographicSource";

export function groupBibliography(references: BibliographicSource[]): Record<string, BibliographicSource[]> {
  return references.reduce<Record<string, BibliographicSource[]>>((acc, reference) => {
    const key = (reference.authors?.[0]?.familyName || reference.organizationAuthor || reference.title || "#")
      .trim()
      .charAt(0)
      .toUpperCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(reference);
    return acc;
  }, {});
}

