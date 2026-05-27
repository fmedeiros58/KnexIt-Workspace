import type { BibliographicSource } from "../../core/BibliographicSource";
import { joinClean } from "../../utils/joinClean";
import { formatApaAuthors, formatApaDate, formatApaTitle } from "./apaHelpers";

export function formatApa7Book(ref: BibliographicSource): string {
  const edition = ref.edition ? `(${ref.edition}).` : "";
  return joinClean([
    `${formatApaAuthors(ref)}.`,
    `${formatApaDate(ref)}.`,
    `${formatApaTitle(ref)}.`,
    edition,
    ref.publisher ? `${ref.publisher}.` : "",
  ]);
}

