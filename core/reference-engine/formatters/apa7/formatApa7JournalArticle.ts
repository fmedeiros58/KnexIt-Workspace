import type { BibliographicSource } from "../../core/BibliographicSource";
import { joinClean } from "../../utils/joinClean";
import {
  formatApaAuthors,
  formatApaContainerVolumeIssue,
  formatApaDate,
  formatApaDoiOrUrl,
  formatApaPages,
  formatApaTitle,
} from "./apaHelpers";

export function formatApa7JournalArticle(ref: BibliographicSource): string {
  const containerVolumeIssue = formatApaContainerVolumeIssue(ref);
  const pages = formatApaPages(ref);
  const doiOrUrl = formatApaDoiOrUrl(ref);

  return joinClean([
    `${formatApaAuthors(ref)}.`,
    `${formatApaDate(ref)}.`,
    `${formatApaTitle(ref)}.`,
    joinClean([
      ref.containerTitle ? `${ref.containerTitle},` : "",
      containerVolumeIssue ? `${containerVolumeIssue},` : "",
      pages ? `${pages}.` : "",
    ]),
    doiOrUrl,
  ]);
}

