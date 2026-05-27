import type {
  CitationOccurrence,
  CitationLocator,
  ReferenceSource,
  ValidationIssue,
} from "../db.types";

export class ReferenceValidationService {
  validateReferenceSource(source: ReferenceSource): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!source.title.trim()) {
      issues.push(this.issue("MISSING_TITLE", "Fonte sem título.", "ReferenceSource", source.id, "error"));
    }
    if (!source.year?.trim()) {
      issues.push(this.issue("MISSING_YEAR", "Fonte sem ano.", "ReferenceSource", source.id, "warning"));
    }
    if (this.isOnlineSource(source) && !source.url?.trim()) {
      issues.push(this.issue("MISSING_URL", "Fonte online sem URL.", "ReferenceSource", source.id, "error"));
    }
    if (this.isOnlineSource(source) && !source.accessDate?.trim()) {
      issues.push(
        this.issue(
          "MISSING_ACCESS_DATE",
          "Fonte online sem data de acesso (necessária para ABNT em muitos cenários).",
          "ReferenceSource",
          source.id,
          "warning",
        ),
      );
    }
    if (source.doi && source.url) {
      issues.push(
        this.issue(
          "DOI_AND_URL",
          "Fonte possui DOI e URL. Priorizar DOI para citação acadêmica quando aplicável.",
          "ReferenceSource",
          source.id,
          "info",
        ),
      );
    }

    return issues;
  }

  validateCitationOccurrence(
    citation: CitationOccurrence,
    source: ReferenceSource | null,
    locator?: CitationLocator | null,
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!source) {
      issues.push(
        this.issue(
          "MISSING_REFERENCE_SOURCE",
          "Citação sem referência bibliográfica vinculada.",
          "CitationOccurrence",
          citation.id,
          "error",
        ),
      );
    }

    if (citation.citationType.startsWith("direct") && !citation.page && !citation.pageStart) {
      issues.push(
        this.issue("MISSING_PAGE_DIRECT_QUOTE", "Citação direta sem página.", "CitationOccurrence", citation.id, "warning"),
      );
    }

    if (locator && locator.status === "text_not_found") {
      issues.push(
        this.issue(
          "BROKEN_LOCATOR",
          "Localizador da citação quebrado: texto não encontrado.",
          "CitationLocator",
          locator.id,
          "warning",
        ),
      );
    }

    return issues;
  }

  validateBibliographyConsistency(args: {
    citations: CitationOccurrence[];
    bibliographyReferenceSourceIds: string[];
    referenceSources: ReferenceSource[];
  }): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const activeCitations = args.citations.filter((citation) => citation.status === "active");
    const citedSourceIds = new Set(activeCitations.map((citation) => citation.referenceSourceId));
    const bibliographySet = new Set(args.bibliographyReferenceSourceIds);

    for (const sourceId of citedSourceIds) {
      if (!bibliographySet.has(sourceId)) {
        issues.push(
          this.issue(
            "CITATION_WITHOUT_BIBLIOGRAPHY_ENTRY",
            "Há citação ativa no texto sem entrada correspondente na bibliografia.",
            "CitationOccurrence",
            sourceId,
            "error",
          ),
        );
      }
    }

    for (const sourceId of bibliographySet) {
      if (!citedSourceIds.has(sourceId)) {
        const source = args.referenceSources.find((item) => item.id === sourceId);
        if (source?.includeAsConsultedWork) continue;
        issues.push(
          this.issue(
            "BIBLIOGRAPHY_ENTRY_WITHOUT_ACTIVE_CITATION",
            "Há referência na bibliografia sem citação ativa no texto.",
            "ReferenceSource",
            sourceId,
            "warning",
          ),
        );
      }
    }

    return issues;
  }

  detectPotentialDuplicates(sources: ReferenceSource[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const seenByDoi = new Map<string, string>();
    const seenByIsbn = new Map<string, string>();
    const seenByTitleYear = new Map<string, string>();

    for (const source of sources) {
      if (source.doi) {
        const existing = seenByDoi.get(source.doi);
        if (existing) {
          issues.push(
            this.issue(
              "DUPLICATE_DOI",
              `Possível duplicidade por DOI entre ${existing} e ${source.id}.`,
              "ReferenceSource",
              source.id,
              "warning",
            ),
          );
        } else {
          seenByDoi.set(source.doi, source.id);
        }
      }

      if (source.isbn) {
        const existing = seenByIsbn.get(source.isbn);
        if (existing) {
          issues.push(
            this.issue(
              "DUPLICATE_ISBN",
              `Possível duplicidade por ISBN entre ${existing} e ${source.id}.`,
              "ReferenceSource",
              source.id,
              "warning",
            ),
          );
        } else {
          seenByIsbn.set(source.isbn, source.id);
        }
      }

      const titleYear = `${(source.title || "").trim().toLowerCase()}|${source.year || ""}`;
      const existingTitleYear = seenByTitleYear.get(titleYear);
      if (existingTitleYear) {
        issues.push(
          this.issue(
            "DUPLICATE_TITLE_YEAR",
            `Possível duplicidade por título/ano entre ${existingTitleYear} e ${source.id}.`,
            "ReferenceSource",
            source.id,
            "info",
          ),
        );
      } else {
        seenByTitleYear.set(titleYear, source.id);
      }
    }

    return issues;
  }

  private isOnlineSource(source: ReferenceSource): boolean {
    return Boolean(source.url) || source.type === "webpage" || source.type === "online_video" || source.type === "social_media_post";
  }

  private issue(
    code: string,
    message: string,
    entityName: string,
    entityId: string | undefined,
    severity: ValidationIssue["severity"],
  ): ValidationIssue {
    return { code, message, entityName, entityId, severity };
  }
}
