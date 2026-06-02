import type { BibliographicSource } from "../../core/BibliographicSource";
import { formatApa7Book } from "./formatApa7Book";
import { formatApa7BookChapter } from "./formatApa7BookChapter";
import { formatApa7Generic } from "./formatApa7Generic";
import { formatApa7JournalArticle } from "./formatApa7JournalArticle";
import { formatApa7Thesis } from "./formatApa7Thesis";
import { formatApa7Video } from "./formatApa7Video";
import { formatApa7Webpage } from "./formatApa7Webpage";

export function formatApa7Reference(source: BibliographicSource): string {
  switch (source.type) {
    case "book":
      return formatApa7Book(source);
    case "bookChapter":
      return formatApa7BookChapter(source);
    case "journalArticle":
    case "magazineArticle":
    case "newspaperArticle":
      return formatApa7JournalArticle(source);
    case "webpage":
    case "website":
      return formatApa7Webpage(source);
    case "thesis":
    case "dissertation":
    case "monograph":
      return formatApa7Thesis(source);
    case "video":
    case "podcast":
      return formatApa7Video(source);
    default:
      return formatApa7Generic(source);
  }
}

