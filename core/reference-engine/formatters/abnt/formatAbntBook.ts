import type { BibliographicSource } from "../../core/BibliographicSource";
import { joinClean } from "../../utils/joinClean";
import {
  formatAbntAuthors,
  formatAbntEdition,
  formatAbntOnlineAccess,
  formatAbntPlacePublisherYear,
  formatAbntTitle,
} from "./abntHelpers";

export function formatAbntBook(ref: BibliographicSource): string {
  return joinClean([
    `${formatAbntAuthors(ref)}.`,
    `${formatAbntTitle(ref)}.`,
    formatAbntEdition(ref),
    formatAbntPlacePublisherYear(ref),
    formatAbntOnlineAccess(ref),
  ]);
}

