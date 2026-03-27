import { createSearchClient } from "../web/search-client";
import { classifyResearchQuery } from "./query-classifier";
import { createLocalFactualDbProvider } from "./local-factual-db-client";
import { createLocalVectorDbProvider } from "./local-vector-db-client";
import { createLocalLibraryProvider } from "./local-library-client";
import {
  createArxivProvider,
  createCrossrefProvider,
  createOpenAlexProvider,
  createPubmedProvider,
} from "./remote-science-providers";
import { ensureDefaultResearchAdapters } from "./register-default-adapters";
import type {
  FederatedResearchOptions,
  FederatedResearchResponse,
  ResearchDocument,
  ResearchProvider,
  ResearchSourceType,
} from "./research-types";
import {
  computeFreshnessScore,
  computeKeywordRelevance,
  computeSourceTrustByType,
  dedupeResearchDocuments,
} from "./provider-utils";

const webSearchClient = createSearchClient();

function createWikipediaProvider(): ResearchProvider {
  return {
    name: "wikipedia",
    sourceType: "wikipedia",
    async search(query: string, options: FederatedResearchOptions = {}): Promise<FederatedResearchResponse> {
      const response = await webSearchClient.searchDetailed(query, {
        maxResults: Math.max(1, Math.min(options.maxResults ?? 5, 8)),
        providers: ["wikipedia_api"],
      });

      const results: ResearchDocument[] = response.results.map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        provider: "wikipedia",
        sourceType: "wikipedia",
        publishedAt: item.publishedAt,
        trustScore: computeSourceTrustByType("wikipedia"),
        freshnessScore: computeFreshnessScore(item.publishedAt),
        relevanceScore: computeKeywordRelevance(query, item.title, item.snippet),
      }));

      return {
        results,
        diagnostics: response.diagnostics.map((d) => ({
          provider: "wikipedia",
          sourceType: "wikipedia" as const,
          ok: d.ok,
          durationMs: d.durationMs,
          statusCode: d.statusCode,
          resultCount: d.resultCount,
          failureKind: d.failureKind,
          message: d.message,
        })),
      };
    },
  };
}

function createGeneralWebProvider(): ResearchProvider {
  return {
    name: "web",
    sourceType: "web",
    async search(query: string, options: FederatedResearchOptions = {}): Promise<FederatedResearchResponse> {
      const response = await webSearchClient.searchDetailed(query, {
        maxResults: Math.max(1, Math.min(options.maxResults ?? 6, 10)),
        providers: ["bing_html", "duckduckgo_html"],
      });

      const results: ResearchDocument[] = response.results.map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        provider: item.provider,
        sourceType: "web",
        publishedAt: item.publishedAt,
        trustScore: computeSourceTrustByType("web"),
        freshnessScore: computeFreshnessScore(item.publishedAt),
        relevanceScore: computeKeywordRelevance(query, item.title, item.snippet),
      }));

      return {
        results,
        diagnostics: response.diagnostics.map((d) => ({
          provider: d.provider,
          sourceType: "web" as const,
          ok: d.ok,
          durationMs: d.durationMs,
          statusCode: d.statusCode,
          resultCount: d.resultCount,
          failureKind: d.failureKind,
          message: d.message,
        })),
      };
    },
  };
}

function shouldIncludeSource(source: ResearchSourceType, allowedSources?: ResearchSourceType[]): boolean {
  if (!allowedSources?.length) return true;
  return allowedSources.includes(source);
}

function createLocalProviders(options: FederatedResearchOptions): ResearchProvider[] {
  if (options.includeLocal === false) return [];
  return [createLocalFactualDbProvider(), createLocalVectorDbProvider(), createLocalLibraryProvider()].filter(
    (provider) => shouldIncludeSource(provider.sourceType, options.allowedSources),
  );
}

function createScienceProviders(options: FederatedResearchOptions): ResearchProvider[] {
  if (options.includeRemote === false) return [];
  return [createPubmedProvider(), createCrossrefProvider(), createOpenAlexProvider(), createArxivProvider()].filter(
    (provider) => shouldIncludeSource(provider.sourceType, options.allowedSources),
  );
}

function createGeneralProviders(options: FederatedResearchOptions): ResearchProvider[] {
  if (options.includeRemote === false) return [];
  return [createWikipediaProvider(), createGeneralWebProvider()].filter((provider) =>
    shouldIncludeSource(provider.sourceType, options.allowedSources),
  );
}

function buildProviderPlan(query: string, options: FederatedResearchOptions): ResearchProvider[] {
  const classified = classifyResearchQuery(query);

  const localProviders = createLocalProviders(options);
  const scienceProviders = createScienceProviders(options);
  const generalProviders = createGeneralProviders(options);

  if (classified.isChitChatLikely) {
    return [];
  }

  if (classified.intent === "local_only") {
    return localProviders;
  }

  if (options.forceScientific || classified.prefersScientificSources) {
    if (classified.prefersBiomedicalSources) {
      return [...localProviders, createPubmedProvider(), createCrossrefProvider(), createOpenAlexProvider(), createWikipediaProvider()].filter(
        (provider) => shouldIncludeSource(provider.sourceType, options.allowedSources),
      );
    }
    if (classified.prefersBibliographicSources) {
      return [...localProviders, createCrossrefProvider(), createOpenAlexProvider(), createArxivProvider(), createWikipediaProvider()].filter(
        (provider) => shouldIncludeSource(provider.sourceType, options.allowedSources),
      );
    }
    return [...localProviders, ...scienceProviders, createWikipediaProvider()].filter((provider) =>
      shouldIncludeSource(provider.sourceType, options.allowedSources),
    );
  }

  if (options.forceCurrent || classified.needsFreshness) {
    return [...localProviders, createGeneralWebProvider(), createWikipediaProvider(), createCrossrefProvider()].filter(
      (provider) => shouldIncludeSource(provider.sourceType, options.allowedSources),
    );
  }

  return [...localProviders, ...generalProviders, createCrossrefProvider(), createOpenAlexProvider()].filter(
    (provider) => shouldIncludeSource(provider.sourceType, options.allowedSources),
  );
}

export interface FederatedResearchClient {
  search: (query: string, options?: FederatedResearchOptions) => Promise<FederatedResearchResponse>;
}

export function createFederatedResearchClient(): FederatedResearchClient {
  ensureDefaultResearchAdapters();
  return {
    async search(query: string, options: FederatedResearchOptions = {}): Promise<FederatedResearchResponse> {
      const normalized = `${query || ""}`.trim();
      if (!normalized) {
        return {
          results: [],
          diagnostics: [],
        };
      }

      const providers = buildProviderPlan(normalized, options);
      if (!providers.length) {
        return {
          results: [],
          diagnostics: [],
        };
      }

      const maxResults = Math.max(1, options.maxResults ?? 12);

      const all = await Promise.all(
        providers.map((provider) =>
          provider.search(normalized, {
            ...options,
            maxResults: Math.max(2, Math.ceil(maxResults / Math.max(1, providers.length)) + 1),
          }),
        ),
      );

      const merged = all.flatMap((entry) => entry.results);
      const diagnostics = all.flatMap((entry) => entry.diagnostics);
      const results = dedupeResearchDocuments(merged, maxResults);

      return {
        results,
        diagnostics,
      };
    },
  };
}
