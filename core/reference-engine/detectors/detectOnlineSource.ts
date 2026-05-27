import type { BibliographicSource } from "../core/BibliographicSource";

export function detectOnlineSource(source: BibliographicSource): boolean {
  return Boolean(source.url || source.doi || source.accessDate);
}

