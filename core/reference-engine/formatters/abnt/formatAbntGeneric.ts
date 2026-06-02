import type { BibliographicSource } from "../../core/BibliographicSource";
import { joinClean } from "../../utils/joinClean";
import {
  formatAbntAuthors,
  formatAbntOnlineAccess,
  formatAbntPlacePublisherYear,
  formatAbntTitle,
} from "./abntHelpers";

export function formatAbntGeneric(ref: BibliographicSource): string {
  return joinClean([
    `${formatAbntAuthors(ref)}.`,
    `${formatAbntTitle(ref)}.`,
    formatAbntPlacePublisherYear(ref),
    formatAbntOnlineAccess(ref),
  ]);
}

