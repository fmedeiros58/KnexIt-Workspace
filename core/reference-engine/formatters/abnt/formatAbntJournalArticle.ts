import type { BibliographicSource } from "../../core/BibliographicSource";
import { formatDateForAbnt } from "../../normalizers/normalizeDate";
import { joinClean } from "../../utils/joinClean";
import { formatAbntAuthors, formatAbntOnlineAccess, formatAbntPages, formatAbntTitle } from "./abntHelpers";

export function formatAbntJournalArticle(ref: BibliographicSource): string {
  const volumeBlock = ref.volume ? `v. ${ref.volume}` : "";
  const issueBlock = ref.issue || ref.number ? `n. ${ref.issue || ref.number}` : "";
  const pagesBlock = formatAbntPages(ref);
  const dateBlock = formatDateForAbnt(ref.publicationDate);
  const doiBlock = ref.doi ? `DOI: ${ref.doi}.` : "";

  return joinClean([
    `${formatAbntAuthors(ref)}.`,
    `${formatAbntTitle(ref)}.`,
    joinClean([
      ref.containerTitle ? `${ref.containerTitle},` : "",
      ref.place ? `${ref.place},` : "",
      volumeBlock ? `${volumeBlock},` : "",
      issueBlock ? `${issueBlock},` : "",
      pagesBlock ? `${pagesBlock},` : "",
      dateBlock ? `${dateBlock}.` : "",
    ]),
    doiBlock,
    !ref.doi ? formatAbntOnlineAccess(ref) : "",
  ]);
}

