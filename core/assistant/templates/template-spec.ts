import type { AcademicGenre } from "@/core/assistant/genre/academic-genre.types";

export type TemplateSectionSpec = {
  title: string;
  required: boolean;
  maxParagraphs: number;
  maxChars: number;
  allowBullets: boolean;
};

export type TemplateRules = {
  noInvention: boolean;
  dedupeAcrossSections: boolean;
  redundancyThreshold: number;
  minCoverage: number;
  minHeadingsCount: number;
};

export type TemplateSpec = {
  id: string;
  genre: AcademicGenre;
  langTag: string;
  title: string;
  sections: TemplateSectionSpec[];
  rules: TemplateRules;
  aliases: Record<string, string>;
};
