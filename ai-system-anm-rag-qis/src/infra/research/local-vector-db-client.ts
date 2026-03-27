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

export interface LocalVectorRecord {
  id: string;
  title: string;
  snippet: string;
  score?: number;
  updatedAt?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface LocalVectorDbAdapter {
  searchSemantic: (query: string, limit: number) => Promise<LocalVectorRecord[]>;
}

const fallbackAdapter: LocalVectorDbAdapter = {
  async searchSemantic() {
    return [];
  },
};

let adapter: LocalVectorDbAdapter = fallbackAdapter;

export function registerLocalVectorDbAdapter(customAdapter: LocalVectorDbAdapter): void {
  adapter = customAdapter || fallbackAdapter;
}

export function createLocalVectorDbProvider(): ResearchProvider {
  return {
    name: "local_vector_db",
    sourceType: "local_vector_db",
    async search(query: string, options: FederatedResearchOptions = {}): Promise<FederatedResearchResponse> {
      const startedAt = Date.now();
      const limit = Math.max(1, options.maxResults ?? 8);

      try {
        const rows = await adapter.searchSemantic(query, limit);

        const results: ResearchDocument[] = rows.map((row) => ({
          id: row.id,
          title: cleanText(row.title, 220),
          snippet: cleanText(row.snippet, 320),
          url: row.url,
          provider: "local_vector_db",
          sourceType: "local_vector_db",
          updatedAt: row.updatedAt,
          metadata: row.metadata,
          trustScore: computeSourceTrustByType("local_vector_db"),
          freshnessScore: computeFreshnessScore(row.updatedAt),
          relevanceScore: Math.max(
            computeKeywordRelevance(query, row.title, row.snippet),
            Math.min(0.99, Math.max(0, row.score ?? 0)),
          ),
          localDocumentId: row.id,
        }));

        return {
          results,
          diagnostics: [
            {
              provider: "local_vector_db",
              sourceType: "local_vector_db",
              ok: true,
              durationMs: Date.now() - startedAt,
              resultCount: results.length,
              message: results.length
                ? "Local vector DB returned results"
                : "Local vector DB returned zero results",
              ...(results.length ? {} : { failureKind: "empty_result" as const }),
            },
          ],
        };
      } catch (error) {
        return {
          results: [],
          diagnostics: [
            {
              provider: "local_vector_db",
              sourceType: "local_vector_db",
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
