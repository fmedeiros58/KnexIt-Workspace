export enum AcademicGenre {
  RESEARCH_PROJECT = "RESEARCH_PROJECT",
  ABSTRACT_SUMMARY = "ABSTRACT_SUMMARY",
  CRITICAL_REVIEW = "CRITICAL_REVIEW",
  THESIS_DISSERTATION_SUMMARY = "THESIS_DISSERTATION_SUMMARY",
  ARTICLE_SUMMARY = "ARTICLE_SUMMARY",
  SYSTEMATIC_REVIEW = "SYSTEMATIC_REVIEW",
  TECHNICAL_REPORT = "TECHNICAL_REPORT",
  GENERIC_ACADEMIC = "GENERIC_ACADEMIC",
}

export type GenreDetectionResult = {
  genre: AcademicGenre;
  confidence: number;
  source: "explicit" | "heuristic" | "fallback";
  matchedTerms: string[];
};
