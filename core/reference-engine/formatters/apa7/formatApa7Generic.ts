import type { BibliographicSource } from "../../core/BibliographicSource";
import { joinClean } from "../../utils/joinClean";
import { formatApaAuthors, formatApaDate, formatApaDoiOrUrl, formatApaTitle } from "./apaHelpers";

export function formatApa7Generic(ref: BibliographicSource): string {
  return joinClean([
    `${formatApaAuthors(ref)}.`,
    `${formatApaDate(ref)}.`,
    `${formatApaTitle(ref)}.`,
    ref.publisher ? `${ref.publisher}.` : "",
    formatApaDoiOrUrl(ref),
  ]);
}

