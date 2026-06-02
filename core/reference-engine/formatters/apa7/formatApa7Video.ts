import type { BibliographicSource } from "../../core/BibliographicSource";
import { joinClean } from "../../utils/joinClean";
import { formatApaAuthors, formatApaDate, formatApaDoiOrUrl, formatApaTitle } from "./apaHelpers";

export function formatApa7Video(ref: BibliographicSource): string {
  return joinClean([
    `${formatApaAuthors(ref)}.`,
    `${formatApaDate(ref)}.`,
    `${formatApaTitle(ref)} [Video].`,
    formatApaDoiOrUrl(ref),
  ]);
}

