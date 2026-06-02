import type { BibliographicSource } from "../core/BibliographicSource";
import { validateReference } from "./validateReference";

export function validateAbnt(source: BibliographicSource) {
  return validateReference(source, "ABNT_NBR_6023_2018");
}

