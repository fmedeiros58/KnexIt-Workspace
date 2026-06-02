import type { BibliographicSource } from "../../core/BibliographicSource";
import { formatPagesRange } from "../../normalizers/normalizePages";
import { joinClean } from "../../utils/joinClean";
import { formatApaAuthors, formatApaDate, formatApaTitle } from "./apaHelpers";

export function formatApa7BookChapter(ref: BibliographicSource): string {
  const editors = ref.contributors?.editors?.length
    ? ref.contributors.editors.map((editor) => editor.literal || `${editor.familyName || ""}, ${editor.givenNames || ""}`.trim()).join(", ")
    : "";
  const pages = formatPagesRange(ref.pages);
  return joinClean([
    `${formatApaAuthors(ref)}.`,
    `${formatApaDate(ref)}.`,
    `${formatApaTitle(ref)}.`,
    editors ? `In ${editors} (Ed.),` : ref.containerTitle ? "In" : "",
    ref.containerTitle ? `${ref.containerTitle}` : "",
    pages ? `(pp. ${pages}).` : ".",
    ref.publisher ? `${ref.publisher}.` : "",
  ]);
}

