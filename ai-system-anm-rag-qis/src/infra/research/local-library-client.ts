import type {
  FederatedResearchOptions,
  FederatedResearchResponse,
  ResearchDocument,
  ResearchProvider,
} from "./research-types";
import {
  cleanText,
  computeFreshnessScore,
  computeKeywordRelevance,
  computeSourceTrustByType,
} from "./provider-utils";

export interface LocalLibraryRecord {
  id: string;
  title: string;
  snippet: string;
  path?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface LocalLibraryAdapter {
  searchDocuments: (query: string, limit: number) => Promise<LocalLibraryRecord[]>;
}

const fallbackAdapter: LocalLibraryAdapter = {
  async searchDocuments() {
    return [];
  },
};

let adapter: LocalLibraryAdapter = fallbackAdapter;

export function registerLocalLibraryAdapter(customAdapter: LocalLibraryAdapter): void {
  adapter = customAdapter || fallbackAdapter;
}

export function createLocalLibraryProvider(): ResearchProvider {
  return {
    name: "local_library",
    sourceType: "local_library",
    async search(query: string, options: FederatedResearchOptions = {}): Promise<FederatedResearchResponse> {
      const startedAt = Date.now();
      const limit = Math.max(1, options.maxResults ?? 8);

      try {
        const rows = await adapter.searchDocuments(query, limit);

        const results: ResearchDocument[] = rows.map((row) => ({
          id: row.id,
          title: cleanText(row.title, 220),
          snippet: cleanText(row.snippet, 320),
          url: row.path,
          provider: "local_library",
          sourceType: "local_library",
          updatedAt: row.updatedAt,
          metadata: row.metadata,
          trustScore: computeSourceTrustByType("local_library"),
          freshnessScore: computeFreshnessScore(row.updatedAt),
          relevanceScore: computeKeywordRelevance(query, row.title, row.snippet),
          localDocumentId: row.id,
        }));

        return {
          results,
          diagnostics: [
            {
              provider: "local_library",
              sourceType: "local_library",
              ok: true,
              durationMs: Date.now() - startedAt,
              resultCount: results.length,
              message: results.length ? "Local library returned results" : "Local library returned zero results",
              ...(results.length ? {} : { failureKind: "empty_result" as const }),
            },
          ],
        };
      } catch (error) {
        return {
          results: [],
          diagnostics: [
            {
              provider: "local_library",
              sourceType: "local_library",
              ok: false,
              durationMs: Date.now() - startedAt,
              resultCount: 0,
              failureKind: "unknown_error",
              message: error instanceof Error ? error.message : `${error}`,
            },
          ],
        };
      }
    },
  };
}
