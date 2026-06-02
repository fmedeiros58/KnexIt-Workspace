import type { BibliographicSource } from "../core/BibliographicSource";
import { parseManualInput } from "./parseManualInput";

export function parseRis(rawRis: string): BibliographicSource {
  const lines = rawRis.split(/\r?\n/);
  const map: Record<string, string[]> = {};
  for (const line of lines) {
    const match = line.match(/^([A-Z0-9]{2})\s*-\s*(.*)$/);
    if (!match) continue;
    const tag = match[1];
    const value = match[2].trim();
    if (!map[tag]) map[tag] = [];
    map[tag].push(value);
  }

  return parseManualInput({
    rawInput: rawRis,
    title: map.TI?.[0] || map.T1?.[0] || "Título não informado",
    publicationDate: { year: map.PY?.[0] || map.Y1?.[0] },
    authors: (map.AU || []).map((literal) => ({ literal, role: "author" })),
    containerTitle: map.JO?.[0] || map.JA?.[0],
    doi: map.DO?.[0],
    url: map.UR?.[0],
    sourceQuality: {
      confidence: "medium",
      missingFields: [],
      warnings: ["Parser RIS simplificado em uso."],
      origin: "ris",
    },
  });
}

