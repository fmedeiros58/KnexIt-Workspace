import type { PersonName } from "../core/BibliographicSource";
import { toTitleCase } from "../utils/stringCase";

const PARTICLES = new Set(["de", "da", "do", "das", "dos", "e", "van", "von"]);

export function normalizeAuthors(authors: PersonName[] | undefined): PersonName[] {
  if (!authors?.length) return [];
  return authors
    .map((author) => ({
      ...author,
      givenNames: author.givenNames?.trim(),
      familyName: author.familyName?.trim(),
      literal: author.literal?.trim(),
      suffix: author.suffix?.trim(),
    }))
    .filter((author) => Boolean(author.literal || author.givenNames || author.familyName));
}

export function formatFamilyNameForAbnt(familyNameRaw: string): string {
  const tokens = familyNameRaw
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return tokens
    .map((token, index) => {
      const lower = token.toLowerCase();
      if (index > 0 && PARTICLES.has(lower)) return lower;
      return toTitleCase(lower);
    })
    .join(" ")
    .toUpperCase();
}

export function formatAuthorAbnt(author: PersonName): string {
  if (author.literal?.trim()) return author.literal.trim().toUpperCase();
  const family = formatFamilyNameForAbnt(author.familyName || "");
  const given = toTitleCase(author.givenNames || "");
  if (family && given) return `${family}, ${given}`;
  if (family) return family;
  return (author.givenNames || "AUTOR DESCONHECIDO").toUpperCase();
}

export function formatAuthorApa(author: PersonName): string {
  if (author.literal?.trim()) return author.literal.trim();
  const family = toTitleCase(author.familyName || "");
  const initials = (author.givenNames || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((name) => `${name.charAt(0).toUpperCase()}.`)
    .join(" ");
  if (family && initials) return `${family}, ${initials}`;
  if (family) return family;
  return initials || "Unknown author";
}

