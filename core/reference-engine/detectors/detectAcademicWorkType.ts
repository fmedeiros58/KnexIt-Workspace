import type { BibliographicSource } from "../core/BibliographicSource";

export function detectAcademicWorkType(source: BibliographicSource): "thesis" | "dissertation" | "monograph" | null {
  const workType = source.academicWork?.workType?.toLowerCase() || "";
  if (workType.includes("tese")) return "thesis";
  if (workType.includes("dissertação")) return "dissertation";
  if (workType.includes("monografia") || workType.includes("tcc")) return "monograph";
  return null;
}

