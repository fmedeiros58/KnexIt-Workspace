import type { CitationStyle } from "./citation-style-router";

export interface CitationConsistencyInput {
  style: CitationStyle;
  citationCount: number;
}

export interface CitationConsistencyResult {
  ok: boolean;
  notes: string[];
}

export function citationConsistencyValidator(input: CitationConsistencyInput): CitationConsistencyResult {
  if (input.style === "none") {
    return { ok: true, notes: [] };
  }
  if (input.citationCount === 0) {
    return { ok: false, notes: ["academic_style_without_citations"] };
  }
  return { ok: true, notes: [] };
}
