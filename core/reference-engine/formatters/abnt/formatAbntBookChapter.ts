import type { BibliographicSource } from "../../core/BibliographicSource";
import { formatPagesRange } from "../../normalizers/normalizePages";
import { joinClean } from "../../utils/joinClean";
import {
  formatAbntAuthors,
  formatAbntEdition,
  formatAbntPlacePublisherYear,
  formatAbntTitle,
} from "./abntHelpers";

export function formatAbntBookChapter(ref: BibliographicSource): string {
  const editors = ref.contributors?.editors?.length
    ? ref.contributors.editors.map((editor) => editor.literal || editor.familyName || "").filter(Boolean).join("; ")
    : "";
  const pages = formatPagesRange(ref.pages);

  return joinClean([
    `${formatAbntAuthors(ref)}.`,
    `${formatAbntTitle(ref)}.`,
    editors ? `In: ${editors}.` : ref.containerTitle ? `In: ${ref.containerTitle}.` : "",
    ref.containerTitle && editors ? `${ref.containerTitle}.` : "",
    formatAbntEdition(ref),
    formatAbntPlacePublisherYear(ref),
    pages ? `p. ${pages}.` : "",
  ]);
}

