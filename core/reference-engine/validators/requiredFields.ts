import type { ReferenceStyle } from "../core/ReferenceStyle";
import type { ReferenceType } from "../core/ReferenceType";

export const REQUIRED_FIELDS: Record<ReferenceStyle, Partial<Record<ReferenceType, string[]>>> = {
  ABNT_NBR_6023_2018: {
    book: ["authors|organizationAuthor", "title", "place", "publisher", "publicationDate.year"],
    journalArticle: ["authors|organizationAuthor", "title", "containerTitle", "publicationDate.year"],
    webpage: ["authors|organizationAuthor", "title", "url", "accessDate"],
    website: ["authors|organizationAuthor", "title", "url", "accessDate"],
    thesis: [
      "authors|organizationAuthor",
      "title",
      "academicWork.workType",
      "academicWork.degree",
      "academicWork.institution",
      "academicWork.place",
      "publicationDate.year",
    ],
    dissertation: [
      "authors|organizationAuthor",
      "title",
      "academicWork.workType",
      "academicWork.degree",
      "academicWork.institution",
      "academicWork.place",
      "publicationDate.year",
    ],
  },
  APA_7: {
    book: ["authors|organizationAuthor", "title", "publisher", "publicationDate.year"],
    journalArticle: ["authors|organizationAuthor", "title", "containerTitle", "publicationDate.year"],
    webpage: ["authors|organizationAuthor", "title", "url"],
    website: ["authors|organizationAuthor", "title", "url"],
    thesis: ["authors|organizationAuthor", "title", "academicWork.workType", "academicWork.institution", "publicationDate.year"],
    dissertation: ["authors|organizationAuthor", "title", "academicWork.workType", "academicWork.institution", "publicationDate.year"],
  },
};

