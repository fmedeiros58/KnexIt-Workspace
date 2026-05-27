import { buildSortKey } from "../utils";
import { now } from "../../utils/dates/now";
import { createId } from "../../utils/ids/createId";
import type {
  BibliographyStyle,
  GeneratedBibliographyEntry,
  ReferenceAuthor,
  ReferenceSource,
  UUID,
} from "../db.types";
import type {
  CitationOccurrenceRepository,
  GeneratedBibliographyEntryRepository,
  ReferenceAuthorRepository,
  ReferenceSourceRepository,
} from "../repositories";
import type { DomainEventBus } from "../../events/DomainEventBus";
import { ReferenceFormatterService } from "./ReferenceFormatterService";

export interface RegenerateDocumentBibliographyInput {
  projectId: UUID;
  documentId: UUID;
  style: BibliographyStyle;
}

export class BibliographyService {
  constructor(
    private readonly citationOccurrenceRepository: CitationOccurrenceRepository,
    private readonly referenceSourceRepository: ReferenceSourceRepository,
    private readonly referenceAuthorRepository: ReferenceAuthorRepository,
    private readonly generatedBibliographyEntryRepository: GeneratedBibliographyEntryRepository,
    private readonly referenceFormatterService: ReferenceFormatterService,
    private readonly domainEventBus?: DomainEventBus,
  ) {}

  async regenerateForDocument(input: RegenerateDocumentBibliographyInput): Promise<GeneratedBibliographyEntry[]> {
    const activeCitations = await this.citationOccurrenceRepository.findActiveByDocument(input.documentId);
    const activeSourceIds = new Set(activeCitations.map((citation) => citation.referenceSourceId));
    const projectSources = await this.referenceSourceRepository.findByProject(input.projectId);

    const includedSources = projectSources.filter(
      (source) => activeSourceIds.has(source.id) || source.includeAsConsultedWork,
    );

    const referencesWithAuthors: Array<{ source: ReferenceSource; authors: ReferenceAuthor[] }> = [];
    for (const source of includedSources) {
      const authors = await this.referenceAuthorRepository.findByReferenceSource(source.id);
      referencesWithAuthors.push({ source, authors });
    }

    const formatted = referencesWithAuthors.map(({ source, authors }) => {
      const formattedText = this.referenceFormatterService.formatReference(source, input.style, authors);
      return {
        source,
        authors,
        formattedText,
        sortKey: buildSortKey([
          authors[0]?.familyName || authors[0]?.personName || source.title,
          source.year,
          source.title,
        ]),
      };
    });

    formatted.sort((left, right) => left.sortKey.localeCompare(right.sortKey, "pt-BR"));

    const timestamp = now();
    const entriesPayload = formatted.map((item) => ({
      projectId: input.projectId,
      documentId: input.documentId,
      referenceSourceId: item.source.id,
      style: input.style,
      formattedText: item.formattedText,
      formattedHtml: undefined,
      sortKey: item.sortKey,
      isIncluded: true,
      generatedFromVersion: item.source.version,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      syncStatus: "updated_locally" as const,
      remoteId: null,
      version: 1,
      lastSyncedAt: null,
      deviceId: null,
    }));

    await this.generatedBibliographyEntryRepository.deleteByDocument(input.documentId);

    const entries = await this.generatedBibliographyEntryRepository.regenerateForDocument({
      projectId: input.projectId,
      documentId: input.documentId,
      style: input.style,
      entries: entriesPayload.map((entry) => ({
        ...entry,
        id: createId(),
      })),
    });

    if (this.domainEventBus) {
      await this.domainEventBus.publish(
        "BibliographyRegenerated",
        {
          projectId: input.projectId,
          documentId: input.documentId,
          style: input.style,
          totalEntries: entries.length,
        },
        { projectId: input.projectId, documentId: input.documentId },
      );
    }

    return entries;
  }
}

