export type { BibliographicSource, DateParts, PageRange, PersonName } from "./core/BibliographicSource";
export type {
  CitationOccurrence,
  ReferenceAttachment,
  ReferenceAuthor,
  ReferenceNote,
  ReferencePreview,
  ReferenceSource,
  ReferenceStyleFormatter,
  ReferenceTag,
  ReferenceValidationResult,
} from "./core/ReferenceEntities";
export type { ReferenceRenderOutput } from "./core/ReferenceOutput";
export type { ReferenceStyle } from "./core/ReferenceStyle";
export type { ReferenceType } from "./core/ReferenceType";
export type { ValidationResult } from "./core/ValidationResult";
export type { CitationInput, CitationOutput } from "./citations/citationTypes";
export type { CitationInstance, DocumentReferenceMemory } from "./storage/documentReferenceIndex";

export { detectReferenceType } from "./detectors/detectReferenceType";
export { normalizeReference } from "./normalizers/normalizeReference";
export { validateReference } from "./validators/validateReference";
export { enrichReference } from "./enrichReference";
export { resolveReferenceStyle } from "./styleResolver";
export { formatReference } from "./formatReference";
export { formatCitation } from "./formatCitation";
export { sortBibliography } from "./bibliography/sortBibliography";
export { groupBibliography } from "./bibliography/groupBibliography";
export { renderBibliography } from "./bibliography/renderBibliography";
export { renderReference } from "./renderReference";
export { parseInput } from "./parseInput";
export { parseManualInput } from "./input/parseManualInput";
export { disambiguateSameAuthorSameYear } from "./citations/disambiguateCitations";
export { createDocumentReferenceMemory, citationOutputToInstance } from "./storage/documentReferenceIndex";
export { appendCitation, upsertReference } from "./storage/referenceMemoryStore";
export { ABNT_TEMPLATES } from "./templates/abntTemplates";
export { APA7_TEMPLATES } from "./templates/apa7Templates";
