import type { BibliographicSource, PersonName } from "./BibliographicSource";
import type { ReferenceRenderOutput } from "./ReferenceOutput";
import type { ReferenceStyle } from "./ReferenceStyle";
import type { ValidationResult } from "./ValidationResult";
import type { CitationInstance } from "../storage/documentReferenceIndex";

export type ReferenceSource = BibliographicSource;

export type CitationOccurrence = CitationInstance;

export type ReferenceAuthor = PersonName;

export type ReferenceAttachment = {
  id: string;
  sourceId: string;
  name: string;
  mimeType?: string;
  url?: string;
  kind?: "pdf" | "image" | "print" | "transcript" | "link" | "other";
};

export type ReferenceNote = {
  id: string;
  sourceId: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ReferenceTag = {
  id: string;
  sourceId: string;
  label: string;
};

export type ReferencePreview = {
  sourceId: string;
  style: ReferenceStyle;
  output: ReferenceRenderOutput;
};

export type ReferenceStyleFormatter = (
  source: BibliographicSource,
  style: ReferenceStyle,
) => ReferenceRenderOutput;

export type ReferenceValidationResult = ValidationResult;

