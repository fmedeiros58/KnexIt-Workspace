/**
 * Responsabilidade do arquivo:
 * - Registrar provedores web e coordenar fallback multi-provider.
 * - Expor health basico e habilitacao/desabilitacao por policy.
 * - Reaproveitar implementacao legado como provider adaptado.
 */
import { createSearchClient } from "../../infra/web/search-client";
import { searchWebFallback } from "../internet-research-core/web-search-client";
import type { EvidenceItem, RetrievalStage, SearchRoundKind } from "./iterative-acquisition-types";

interface RegistrySearchInput {
  query: string;
  round: SearchRoundKind;
  stage: RetrievalStage;
  providers: string[];
  maxResults: number;
}

interface WebProvider {
  id: string;
  enabled: boolean;
  search: (query: string, maxResults: number, providers: string[]) => Promise<EvidenceItem[]>;
  health: () => Promise<boolean>;
}

const searchClient = createSearchClient();

function makeEvidenceId(provider: string, url: string): string {
  return `web:${provider}:${url}`.toLowerCase();
}

function convertResultToEvidence(
  item: { title: string; url: string; snippet: string; provider: string; publishedAt?: string },
  stage: RetrievalStage,
  round: SearchRoundKind,
): EvidenceItem {
  return {
    id: makeEvidenceId(item.provider, item.url),
    title: item.title || "web-result",
    url: item.url,
    snippet: item.snippet || "",
    sourceType: "web",
    provider: item.provider || "web_unknown",
    stage,
    round,
    relevanceScore: 0.56,
    trustScore: 0.54,
    freshnessScore: item.publishedAt ? 0.72 : 0.52,
    retrievalScore: 0.56,
    publishedAt: item.publishedAt,
    tags: ["web", "external_lookup"],
  };
}

const PROVIDERS = new Map<string, WebProvider>([
  [
    "multi_provider_client",
    {
      id: "multi_provider_client",
      enabled: true,
      search: async (query, maxResults, providers) => {
        const rows = await searchClient.search(query, {
          maxResults,
          providers: providers.length ? providers : undefined,
        });
        return rows.map((row) =>
          convertResultToEvidence(
            {
              title: row.title,
              url: row.url,
              snippet: row.snippet,
              provider: row.provider,
              publishedAt: row.publishedAt,
            },
            "web_multi_provider",
            "focalization",
          ),
        );
      },
      health: async () => true,
    },
  ],
  [
    "legacy_web_fallback",
    {
      id: "legacy_web_fallback",
      enabled: true,
      search: async (query) => {
        const rows = await searchWebFallback(query);
        return rows.map((row) =>
          convertResultToEvidence(
            {
              title: row.title,
              url: row.url,
              snippet: row.snippet,
              provider: "legacy_web_fallback",
            },
            "web_multi_provider",
            "focalization",
          ),
        );
      },
      health: async () => true,
    },
  ],
]);

export async function runWebSearchProviderRegistry(input: RegistrySearchInput): Promise<EvidenceItem[]> {
  const query = input.query.trim();
  if (!query) return [];

  const orderedProviders = ["multi_provider_client", "legacy_web_fallback"];
  const output: EvidenceItem[] = [];

  for (const providerId of orderedProviders) {
    const provider = PROVIDERS.get(providerId);
    if (!provider || !provider.enabled) continue;
    const healthy = await provider.health().catch(() => false);
    if (!healthy) continue;

    const rows = await provider.search(query, input.maxResults, input.providers).catch(() => []);
    for (const row of rows) {
      output.push({
        ...row,
        stage: input.stage,
        round: input.round,
      });
    }
    if (output.length >= input.maxResults) break;
  }

  const dedup = new Map<string, EvidenceItem>();
  for (const row of output) {
    const key = `${row.url}`.toLowerCase();
    if (!key) continue;
    if (!dedup.has(key)) {
      dedup.set(key, row);
      continue;
    }
    const existing = dedup.get(key)!;
    if ((row.snippet.length + row.title.length) > (existing.snippet.length + existing.title.length)) {
      dedup.set(key, row);
    }
  }

  return Array.from(dedup.values()).slice(0, input.maxResults);
}

export function getRegisteredWebProviderIds(): string[] {
  return Array.from(PROVIDERS.values())
    .filter((provider) => provider.enabled)
    .map((provider) => provider.id);
}

