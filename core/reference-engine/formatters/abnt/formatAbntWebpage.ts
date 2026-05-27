import type { BibliographicSource } from "../../core/BibliographicSource";
import { formatDateForAbnt } from "../../normalizers/normalizeDate";
import { joinClean } from "../../utils/joinClean";
import { formatAbntAuthors, formatAbntOnlineAccess, formatAbntTitle } from "./abntHelpers";

export function formatAbntWebpage(ref: BibliographicSource): string {
  const dateLabel = formatDateForAbnt(ref.publicationDate);

  return joinClean([
    `${formatAbntAuthors(ref)}.`,
    `${formatAbntTitle(ref)}.`,
    ref.containerTitle ? `${ref.containerTitle},` : "",
    dateLabel ? `${dateLabel}.` : "",
    formatAbntOnlineAccess(ref),
  ]);
}

