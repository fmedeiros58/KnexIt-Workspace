import type { BibliographicSource } from "../../core/BibliographicSource";
import { joinClean } from "../../utils/joinClean";
import { formatAbntAuthors, formatAbntTitle } from "./abntHelpers";

export function formatAbntThesis(ref: BibliographicSource): string {
  const depositYear = ref.depositDate?.year || ref.publicationDate?.year || "s. d.";
  const workType = ref.academicWork?.workType || "Trabalho acadêmico";
  const degree = ref.academicWork?.degree || "";
  const course = ref.academicWork?.course || ref.program || "";
  const institution = ref.academicWork?.institution || ref.institution || "";
  const place = ref.academicWork?.place || ref.place || "[S. l.]";
  const year = ref.publicationDate?.year || depositYear;
  const degreeBlock = degree ? `${degree}${course ? ` em ${course}` : ""}` : course;

  return joinClean([
    `${formatAbntAuthors(ref)}.`,
    `${formatAbntTitle(ref)}.`,
    `${depositYear}.`,
    `${workType}${degreeBlock ? ` (${degreeBlock})` : ""} - ${institution || "[Instituição não informada]"}, ${place}, ${year}.`,
  ]);
}

