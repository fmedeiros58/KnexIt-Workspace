import type { ReferenceSource } from "../db.types";
import type { ReferenceSourceRepository } from "../repositories";
import { normalizeText } from "../utils";

export class ReferenceSearchService {
  constructor(private readonly referenceSourceRepository: ReferenceSourceRepository) {}

  async searchByText(projectId: string, query: string): Promise<ReferenceSource[]> {
    const normalized = normalizeText(query);
    const sources = await this.referenceSourceRepository.findByProject(projectId);
    return sources.filter((source) => {
      const title = normalizeText(source.title);
      const subtitle = normalizeText(source.subtitle || "");
      const authors = normalizeText(source.styleMetadataJson ? JSON.stringify(source.styleMetadataJson) : "");
      return title.includes(normalized) || subtitle.includes(normalized) || authors.includes(normalized);
    });
  }
}

