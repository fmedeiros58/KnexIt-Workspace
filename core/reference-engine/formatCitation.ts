import type { BibliographicSource } from "./core/BibliographicSource";
import type { CitationInput, CitationOutput } from "./citations/citationTypes";
import { formatAbntCitation } from "./citations/formatAbntCitation";
import { formatApa7Citation } from "./citations/formatApa7Citation";

export function formatCitation(source: BibliographicSource, input: CitationInput): CitationOutput {
  return input.style === "APA_7"
    ? formatApa7Citation(source, input)
    : formatAbntCitation(source, input);
}

