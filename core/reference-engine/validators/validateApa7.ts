import type { BibliographicSource } from "../core/BibliographicSource";
import { validateReference } from "./validateReference";

export function validateApa7(source: BibliographicSource) {
  return validateReference(source, "APA_7");
}

