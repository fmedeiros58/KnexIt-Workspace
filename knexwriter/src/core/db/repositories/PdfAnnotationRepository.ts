import type { PdfAnnotation, UUID } from "../db.types";
import type { BaseRepository } from "./BaseRepository";

export interface PdfAnnotationRepository extends BaseRepository<PdfAnnotation> {
  findByFile(fileAssetId: UUID): Promise<PdfAnnotation[]>;
  findByPage(fileAssetId: UUID, pageNumber: number): Promise<PdfAnnotation[]>;
  findByCitation(citationOccurrenceId: UUID): Promise<PdfAnnotation[]>;
  linkToCitation(annotationId: UUID, citationOccurrenceId: UUID): Promise<void>;
  unlinkFromCitation(annotationId: UUID, citationOccurrenceId: UUID): Promise<void>;
  findUnlinkedAnnotations(fileAssetId: UUID): Promise<PdfAnnotation[]>;
}

