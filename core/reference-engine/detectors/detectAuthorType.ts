import type { BibliographicSource } from "../core/BibliographicSource";

export function detectAuthorType(source: BibliographicSource): "person" | "organization" | "missing" {
  if (source.authors?.length) return "person";
  if (source.organizationAuthor?.trim()) return "organization";
  return "missing";
}

