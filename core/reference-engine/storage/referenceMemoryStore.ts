import type { BibliographicSource } from "../core/BibliographicSource";
import type { CitationInstance, DocumentReferenceMemory } from "./documentReferenceIndex";

export function upsertReference(memory: DocumentReferenceMemory, source: BibliographicSource): DocumentReferenceMemory {
  const existingIndex = memory.references.findIndex((reference) => reference.id === source.id);
  if (existingIndex < 0) {
    return {
      ...memory,
      references: [...memory.references, source],
    };
  }

  const nextReferences = [...memory.references];
  nextReferences[existingIndex] = source;
  return {
    ...memory,
    references: nextReferences,
  };
}

export function appendCitation(memory: DocumentReferenceMemory, citation: CitationInstance): DocumentReferenceMemory {
  return {
    ...memory,
    citations: [...memory.citations, citation],
  };
}

