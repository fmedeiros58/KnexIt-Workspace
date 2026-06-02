import type { BibliographicSource } from "../core/BibliographicSource";
import { parseManualInput } from "./parseManualInput";

export function parseBibtex(rawBibtex: string): BibliographicSource {
  // Minimal parser fallback; dedicated parser can replace this module later.
  const titleMatch = rawBibtex.match(/title\s*=\s*[{"]([^}"]+)[}"]/i);
  const yearMatch = rawBibtex.match(/year\s*=\s*[{"]([^}"]+)[}"]/i);
  const authorMatch = rawBibtex.match(/author\s*=\s*[{"]([^}"]+)[}"]/i);

  return parseManualInput({
    rawInput: rawBibtex,
    title: titleMatch?.[1] || "Título não informado",
    publicationDate: { year: yearMatch?.[1] },
    authors: authorMatch
      ? authorMatch[1].split(/\s+and\s+/i).map((name) => ({ literal: name.trim(), role: "author" }))
      : [],
    sourceQuality: {
      confidence: "medium",
      missingFields: [],
      warnings: ["Parser BibTeX simplificado em uso."],
      origin: "bibtex",
    },
  });
}

