import type { CitationOccurrence, UUID } from "../db.types";
import type { CitationOccurrenceRepository } from "../repositories";
import type { DomainEventBus } from "../../events/DomainEventBus";
import { CrudService } from "./CrudService";

export class CitationOccurrenceService extends CrudService<CitationOccurrence> {
  constructor(
    protected readonly citationOccurrenceRepository: CitationOccurrenceRepository,
    private readonly domainEventBus?: DomainEventBus,
  ) {
    super(citationOccurrenceRepository);
  }

  override async create(input: Omit<CitationOccurrence, "id"> & { id?: string }): Promise<CitationOccurrence> {
    const citation = await super.create(input);
    if (this.domainEventBus) {
      await this.domainEventBus.publish(
        "CitationOccurrenceCreated",
        { citationOccurrenceId: citation.id, referenceSourceId: citation.referenceSourceId },
        { projectId: citation.projectId, documentId: citation.documentId },
      );
      await this.domainEventBus.publish(
        "BibliographyNeedsRegeneration",
        { reason: "citation_created", citationOccurrenceId: citation.id },
        { projectId: citation.projectId, documentId: citation.documentId },
      );
    }
    return citation;
  }

  override async delete(id: UUID): Promise<void> {
    const citation = await this.findById(id);
    await super.delete(id);
    if (!citation || !this.domainEventBus) return;
    await this.domainEventBus.publish(
      "CitationOccurrenceDeleted",
      { citationOccurrenceId: citation.id, referenceSourceId: citation.referenceSourceId },
      { projectId: citation.projectId, documentId: citation.documentId },
    );
    await this.domainEventBus.publish(
      "BibliographyNeedsRegeneration",
      { reason: "citation_deleted", citationOccurrenceId: citation.id },
      { projectId: citation.projectId, documentId: citation.documentId },
    );
  }

  findByDocument(documentId: UUID): Promise<CitationOccurrence[]> {
    return this.citationOccurrenceRepository.findByDocument(documentId);
  }

  findActiveByDocument(documentId: UUID): Promise<CitationOccurrence[]> {
    return this.citationOccurrenceRepository.findActiveByDocument(documentId);
  }

  async markAsUnused(id: UUID): Promise<void> {
    const citation = await this.findById(id);
    await this.citationOccurrenceRepository.markAsUnused(id);
    if (!citation || !this.domainEventBus) return;
    await this.domainEventBus.publish(
      "CitationOccurrenceMarkedUnused",
      { citationOccurrenceId: citation.id, referenceSourceId: citation.referenceSourceId },
      { projectId: citation.projectId, documentId: citation.documentId },
    );
    await this.domainEventBus.publish(
      "BibliographyNeedsRegeneration",
      { reason: "citation_marked_unused", citationOccurrenceId: citation.id },
      { projectId: citation.projectId, documentId: citation.documentId },
    );
  }
}
