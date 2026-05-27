import type { BaseEntity } from "./db.types";

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function normalizeAuthorName(familyName: string, givenName?: string): string {
  const family = familyName.trim().toUpperCase();
  const given = (givenName || "").trim();
  return given ? `${family}, ${given}` : family;
}

export function buildSortKey(parts: Array<string | undefined | null>): string {
  return parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .map((part) => normalizeText(part))
    .join("|");
}

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function softDeleteEntity<T extends BaseEntity>(entity: T, deletedAtIso: string): T {
  return {
    ...entity,
    deletedAt: deletedAtIso,
    updatedAt: deletedAtIso,
    syncStatus: "deleted_locally",
    version: entity.version + 1,
  };
}

