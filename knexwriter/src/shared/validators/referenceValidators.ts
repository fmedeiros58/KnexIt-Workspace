import type { CitationOccurrence, ReferenceSource } from "../../core/db";

export function isValidReferenceSource(source: ReferenceSource): boolean {
  return Boolean(source.title.trim() && source.projectId && source.type);
}

export function isValidCitationOccurrence(citation: CitationOccurrence): boolean {
  return Boolean(citation.documentId && citation.referenceSourceId && citation.citationType && citation.citationMode);
}

