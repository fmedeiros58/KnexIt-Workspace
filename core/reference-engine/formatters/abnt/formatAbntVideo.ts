import type { BibliographicSource } from "../../core/BibliographicSource";
import { formatDateForAbnt } from "../../normalizers/normalizeDate";
import { joinClean } from "../../utils/joinClean";
import { formatAbntAuthors, formatAbntOnlineAccess, formatAbntTitle } from "./abntHelpers";

export function formatAbntVideo(ref: BibliographicSource): string {
  return joinClean([
    `${formatAbntAuthors(ref)}.`,
    `${formatAbntTitle(ref)}.`,
    "Vídeo.",
    ref.publicationDate ? `${formatDateForAbnt(ref.publicationDate)}.` : "",
    formatAbntOnlineAccess(ref),
  ]);
}

