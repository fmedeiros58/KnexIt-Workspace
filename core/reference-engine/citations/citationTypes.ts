import type { ReferenceStyle } from "../core/ReferenceStyle";

export type CitationOccurrenceType =
  | "directShort"
  | "directLong"
  | "indirect"
  | "citationOfCitation"
  | "paraphrase"
  | "narrativeMention";

export type CitationCallFormat = "authorDate" | "footnote" | "numeric";

export type CitationInput = {
  sourceId: string;
  style: ReferenceStyle;
  mode: "parenthetical" | "narrative";
  occurrenceType?: CitationOccurrenceType;
  callFormat?: CitationCallFormat;
  locator?: {
    type: "page" | "paragraph" | "section" | "chapter";
    value: string;
  };
};

export type CitationOutput = {
  citation: string;
  sourceId: string;
  style: ReferenceStyle;
};
