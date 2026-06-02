import type { BibliographicSource } from "../core/BibliographicSource";
import type { ReferenceType } from "../core/ReferenceType";

export function detectReferenceType(source: Partial<BibliographicSource>): ReferenceType {
  if (source.type && source.type !== "generic") return source.type;

  const title = source.title?.toLowerCase() || "";
  const hasAcademicWork = Boolean(source.academicWork?.workType || source.program || source.institution);

  if (source.doi && source.containerTitle) return "journalArticle";
  if (source.isbn) return "book";
  if (source.url && (title.includes("site") || title.includes("página"))) return "webpage";
  if (source.url) return "website";
  if (hasAcademicWork) {
    if (source.academicWork?.workType?.toLowerCase().includes("dissertação")) return "dissertation";
    if (source.academicWork?.workType?.toLowerCase().includes("tese")) return "thesis";
    return "thesis";
  }
  if (source.containerTitle && source.pages) return "journalArticle";
  if (source.publisher) return "book";
  return "generic";
}

