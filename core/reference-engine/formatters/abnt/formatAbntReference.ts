import type { BibliographicSource } from "../../core/BibliographicSource";
import { formatAbntBook } from "./formatAbntBook";
import { formatAbntBookChapter } from "./formatAbntBookChapter";
import { formatAbntGeneric } from "./formatAbntGeneric";
import { formatAbntJournalArticle } from "./formatAbntJournalArticle";
import { formatAbntLegislation } from "./formatAbntLegislation";
import { formatAbntThesis } from "./formatAbntThesis";
import { formatAbntVideo } from "./formatAbntVideo";
import { formatAbntWebpage } from "./formatAbntWebpage";

export function formatAbntReference(source: BibliographicSource): string {
  switch (source.type) {
    case "book":
      return formatAbntBook(source);
    case "bookChapter":
      return formatAbntBookChapter(source);
    case "journalArticle":
    case "magazineArticle":
    case "newspaperArticle":
      return formatAbntJournalArticle(source);
    case "webpage":
    case "website":
      return formatAbntWebpage(source);
    case "thesis":
    case "dissertation":
    case "monograph":
      return formatAbntThesis(source);
    case "law":
    case "legislation":
    case "courtDecision":
      return formatAbntLegislation(source);
    case "video":
    case "podcast":
      return formatAbntVideo(source);
    default:
      return formatAbntGeneric(source);
  }
}

