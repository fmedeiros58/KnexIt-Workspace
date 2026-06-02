import type { BibliographicSource } from "../../core/BibliographicSource";
import { joinClean } from "../../utils/joinClean";
import { formatApaAuthors, formatApaDate, formatApaDoiOrUrl, formatApaTitle } from "./apaHelpers";

export function formatApa7Webpage(ref: BibliographicSource): string {
  const author = formatApaAuthors(ref);
  const date = formatApaDate(ref);
  const title = formatApaTitle(ref);
  const siteName = ref.containerTitle || "";
  const url = formatApaDoiOrUrl(ref);

  const includeSite = siteName && siteName.toLowerCase() !== author.toLowerCase();

  return joinClean([
    `${author}.`,
    `${date}.`,
    `${title}.`,
    includeSite ? `${siteName}.` : "",
    url,
  ]);
}

