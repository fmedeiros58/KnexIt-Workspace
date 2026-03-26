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

export interface LocalFactualRecord {
  id: string;
  title: string;
  snippet: string;
  updatedAt?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface LocalFactualDbAdapter {
  searchFacts: (query: string, limit: number) => Promise<LocalFactualRecord[]>;
}

const fallbackAdapter: LocalFactualDbAdapter = {
  async searchFacts() {
    return [];
  },
};

let adapter: LocalFactualDbAdapter = fallbackAdapter;

export function registerLocalFactualDbAdapter(customAdapter: LocalFactualDbAdapter): void {
  adapter = customAdapter || fallbackAdapter;
}

export function createLocalFactualDbProvider(): ResearchProvider {
  return {
    name: "local_factual_db",
    sourceType: "local_factual_db",
    async search(query: string, options: FederatedResearchOptions = {}): Promise<FederatedResearchResponse> {
      const startedAt = Date.now();
      const limit = Math.max(1, options.maxResults ?? 8);

      try {
        const rows = await adapter.searchFacts(query, limit);

        const results: ResearchDocument[] = rows.map((row) => ({
          id: row.id,
          title: cleanText(row.title, 220),
          snippet: cleanText(row.snippet, 320),
          url: row.url,
          provider: "local_factual_db",
          sourceType: "local_factual_db",
          updatedAt: row.updatedAt,
          metadata: row.metadata,
          trustScore: computeSourceTrustByType("local_factual_db"),
          freshnessScore: computeFreshnessScore(row.updatedAt),
          relevanceScore: computeKeywordRelevance(query, row.title, row.snippet),
          localDocumentId: row.id,
        }));

        return {
          results,
          diagnostics: [
            {
              provider: "local_factual_db",
              sourceType: "local_factual_db",
              ok: true,
              durationMs: Date.now() - startedAt,
              resultCount: results.length,
              message: results.length
                ? "Local factual DB returned results"
                : "Local factual DB returned zero results",
              ...(results.length ? {} : { failureKind: "empty_result" as const }),
            },
          ],
        };
      } catch (error) {
        return {
          results: [],
          diagnostics: [
            {
              provider: "local_factual_db",
              sourceType: "local_factual_db",
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
