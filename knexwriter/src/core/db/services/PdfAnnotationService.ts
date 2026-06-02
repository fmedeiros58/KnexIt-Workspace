import type { PdfAnnotation, UUID } from "../db.types";
import type { PdfAnnotationRepository } from "../repositories";
import type { DomainEventBus } from "../../events/DomainEventBus";
import { CrudService } from "./CrudService";

export class PdfAnnotationService extends CrudService<PdfAnnotation> {
  constructor(
    protected readonly pdfAnnotationRepository: PdfAnnotationRepository,
    private readonly domainEventBus?: DomainEventBus,
  ) {
    super(pdfAnnotationRepository);
  }

  override async create(input: Omit<PdfAnnotation, "id"> & { id?: string }): Promise<PdfAnnotation> {
    const annotation = await super.create(input);
    if (this.domainEventBus) {
      await this.domainEventBus.publish(
        "PdfAnnotationCreated",
        { pdfAnnotationId: annotation.id, fileAssetId: annotation.fileAssetId },
        { projectId: annotation.projectId, documentId: annotation.documentId },
      );
    }
    return annotation;
  }

  findByFile(fileAssetId: UUID): Promise<PdfAnnotation[]> {
    return this.pdfAnnotationRepository.findByFile(fileAssetId);
  }

  async linkToCitation(annotationId: UUID, citationOccurrenceId: UUID): Promise<void> {
    await this.pdfAnnotationRepository.linkToCitation(annotationId, citationOccurrenceId);
    if (this.domainEventBus) {
      await this.domainEventBus.publish(
        "PdfAnnotationLinkedToCitation",
        { pdfAnnotationId: annotationId, citationOccurrenceId },
      );
    }
  }
}
