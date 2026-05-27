import type { PdfAnchor, UUID } from "../db.types";
import type { BaseRepository } from "./BaseRepository";

export interface PdfAnchorRepository extends BaseRepository<PdfAnchor> {
  findByFile(fileAssetId: UUID): Promise<PdfAnchor[]>;
  findByAnnotation(pdfAnnotationId: UUID): Promise<PdfAnchor[]>;
}

