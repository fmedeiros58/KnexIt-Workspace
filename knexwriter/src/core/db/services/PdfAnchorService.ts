import type { PdfAnchor, UUID } from "../db.types";
import type { PdfAnchorRepository } from "../repositories";
import { CrudService } from "./CrudService";

export class PdfAnchorService extends CrudService<PdfAnchor> {
  constructor(protected readonly pdfAnchorRepository: PdfAnchorRepository) {
    super(pdfAnchorRepository);
  }

  findByFile(fileAssetId: UUID): Promise<PdfAnchor[]> {
    return this.pdfAnchorRepository.findByFile(fileAssetId);
  }
}

