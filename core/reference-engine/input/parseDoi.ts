import type { BibliographicSource } from "../core/BibliographicSource";
import { parseManualInput } from "./parseManualInput";

export function parseDoi(doi: string): BibliographicSource {
  const cleaned = doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  return parseManualInput({
    doi: cleaned,
    title: "Título não informado",
    sourceQuality: {
      confidence: "low",
      missingFields: ["title", "authors", "publicationDate.year"],
      warnings: ["DOI recebido sem metadados resolvidos."],
      origin: "doi",
    },
  });
}

