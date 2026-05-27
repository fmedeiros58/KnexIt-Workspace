import type { BibliographicSource } from "../core/BibliographicSource";
import { parseManualInput } from "./parseManualInput";

export function parseUrlMetadata(url: string, metadata?: Partial<BibliographicSource>): BibliographicSource {
  return parseManualInput({
    ...metadata,
    url,
    title: metadata?.title || "Título não informado",
    sourceQuality: {
      confidence: metadata?.title ? "medium" : "low",
      missingFields: metadata?.title ? [] : ["title"],
      warnings: metadata?.title ? [] : ["URL recebida sem metadados completos."],
      origin: "url",
    },
  });
}

