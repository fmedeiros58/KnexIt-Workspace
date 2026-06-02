import type { BibliographicSource } from "../core/BibliographicSource";
import { parseManualInput } from "./parseManualInput";

export function parseIsbn(isbn: string): BibliographicSource {
  const cleaned = isbn.replace(/[^0-9Xx]/g, "");
  return parseManualInput({
    isbn: cleaned,
    type: "book",
    title: "Título não informado",
    sourceQuality: {
      confidence: "low",
      missingFields: ["title", "authors", "publisher", "publicationDate.year"],
      warnings: ["ISBN recebido sem metadados resolvidos."],
      origin: "isbn",
    },
  });
}

