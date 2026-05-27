import type { ReferenceSource, UUID } from "../db.types";
import type { ReferenceSourceRepository } from "../repositories";
import type { DomainEventBus } from "../../events/DomainEventBus";
import { CrudService } from "./CrudService";

export class ReferenceSourceService extends CrudService<ReferenceSource> {
  constructor(
    protected readonly referenceSourceRepository: ReferenceSourceRepository,
    private readonly domainEventBus?: DomainEventBus,
  ) {
    super(referenceSourceRepository);
  }

  override async create(input: Omit<ReferenceSource, "id"> & { id?: string }): Promise<ReferenceSource> {
    const source = await super.create(input);
    if (this.domainEventBus) {
      await this.domainEventBus.publish(
        "ReferenceSourceCreated",
        { referenceSourceId: source.id, type: source.type },
        { projectId: source.projectId },
      );
    }
    return source;
  }

  override async update(id: UUID, patch: Partial<ReferenceSource>): Promise<ReferenceSource> {
    const source = await super.update(id, patch);
    if (this.domainEventBus) {
      await this.domainEventBus.publish(
        "ReferenceSourceUpdated",
        { referenceSourceId: source.id, changedFields: Object.keys(patch) },
        { projectId: source.projectId },
      );
      await this.domainEventBus.publish(
        "BibliographyNeedsRegeneration",
        { reason: "reference_source_updated", referenceSourceId: source.id },
        { projectId: source.projectId },
      );
    }
    return source;
  }

  findByDoi(projectId: UUID, doi: string): Promise<ReferenceSource[]> {
    return this.referenceSourceRepository.findByDoi(projectId, doi);
  }

  findByIsbn(projectId: UUID, isbn: string): Promise<ReferenceSource[]> {
    return this.referenceSourceRepository.findByIsbn(projectId, isbn);
  }

  findByUrl(projectId: UUID, url: string): Promise<ReferenceSource[]> {
    return this.referenceSourceRepository.findByUrl(projectId, url);
  }

  findByTitleAndYear(projectId: UUID, title: string, year?: string): Promise<ReferenceSource[]> {
    return this.referenceSourceRepository.findByTitleAndYear(projectId, title, year);
  }
}
