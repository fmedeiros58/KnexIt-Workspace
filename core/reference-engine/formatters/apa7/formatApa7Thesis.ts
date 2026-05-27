import type { BibliographicSource } from "../../core/BibliographicSource";
import { joinClean } from "../../utils/joinClean";
import { formatApaAuthors, formatApaDate, formatApaDoiOrUrl, formatApaThesisBracket, formatApaTitle } from "./apaHelpers";

export function formatApa7Thesis(ref: BibliographicSource): string {
  return joinClean([
    `${formatApaAuthors(ref)}.`,
    `${formatApaDate(ref)}.`,
    `${formatApaTitle(ref)}.`,
    formatApaThesisBracket(ref),
    ref.repositoryName ? `${ref.repositoryName}.` : "",
    formatApaDoiOrUrl(ref),
  ]);
}

