import type { CitationStyle } from "./citation-style-router";

export interface BibliographicNormalizerInput {
  text: string;
  style: CitationStyle;
  citations: string[];
}

export interface BibliographicNormalizerResult {
  text: string;
  citationCount: number;
}

function toLabel(style: CitationStyle): string {
  if (style === "none") return "Referencias";
  return `Referencias (${style.toUpperCase()})`;
}

export function bibliographicNormalizer(input: BibliographicNormalizerInput): BibliographicNormalizerResult {
  if (input.style === "none" || input.citations.length === 0) {
    return {
      text: input.text,
      citationCount: 0,
    };
  }

  const unique = [...new Set(input.citations)].slice(0, 8);
  const bibliography = [
    "",
    `${toLabel(input.style)}:`,
    ...unique.map((item, index) => `${index + 1}. ${item}`),
  ].join("\n");

  return {
    text: `${input.text}\n${bibliography}`.trim(),
    citationCount: unique.length,
  };
}
