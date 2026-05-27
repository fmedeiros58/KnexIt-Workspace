import type { BibliographicSource } from "../../core/BibliographicSource";
import { formatDateForAbnt } from "../../normalizers/normalizeDate";
import { joinClean } from "../../utils/joinClean";
import { formatAbntAuthors, formatAbntOnlineAccess, formatAbntTitle } from "./abntHelpers";

export function formatAbntLegislation(ref: BibliographicSource): string {
  const lawNumber = ref.legal?.lawNumber ? `n. ${ref.legal.lawNumber}` : "";
  const lawDate = ref.legal?.lawDate ? formatDateForAbnt(ref.legal.lawDate) : "";
  return joinClean([
    `${formatAbntAuthors(ref)}.`,
    `${formatAbntTitle(ref)}.`,
    lawNumber,
    lawDate,
    ref.legal?.officialGazette ? `${ref.legal.officialGazette}.` : "",
    formatAbntOnlineAccess(ref),
  ]);
}

