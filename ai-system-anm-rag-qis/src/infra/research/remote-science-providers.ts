import { createFetchClient } from "../web/fetch-client";
import type {
  FederatedResearchOptions,
  FederatedResearchResponse,
  ResearchDocument,
  ResearchFailureKind,
  ResearchProvider,
} from "./research-types";
import {
  cleanText,
  computeFreshnessScore,
  computeKeywordRelevance,
  computeSourceTrustByType,
} from "./provider-utils";

const fetchClient = createFetchClient();

function okResponse(
  provider: string,
  sourceType: ResearchDocument["sourceType"],
  results: ResearchDocument[],
  startedAt: number,
  statusCode?: number,
  message?: string,
): FederatedResearchResponse {
  return {
    results,
    diagnostics: [
      {
        provider,
        sourceType,
        ok: true,
        durationMs: Date.now() - startedAt,
        resultCount: results.length,
        statusCode,
        message:
          message ||
          (results.length ? `${provider} returned results` : `${provider} returned zero results`),
        ...(results.length ? {} : { failureKind: "empty_result" as const }),
      },
    ],
  };
}

function failResponse(
  provider: string,
  sourceType: ResearchDocument["sourceType"],
  startedAt: number,
  failureKind: ResearchFailureKind,
  message: string,
  statusCode?: number,
): FederatedResearchResponse {
  return {
    results: [],
    diagnostics: [
      {
        provider,
        sourceType,
        ok: false,
        durationMs: Date.now() - startedAt,
        resultCount: 0,
        statusCode,
        failureKind,
        message,
      },
    ],
  };
}

function normalizeFailureKind(errorKind?: string): ResearchFailureKind {
  if (errorKind === "timeout") return "timeout";
  if (errorKind === "network_error") return "network_error";
  if (errorKind === "http_error") return "http_error";
  if (errorKind === "parse_error") return "parse_error";
  if (errorKind === "empty_result") return "empty_result";
  if (errorKind === "unsupported") return "unsupported";
  return "unknown_error";
}

export function createPubmedProvider(): ResearchProvider {
  return {
    name: "pubmed",
    sourceType: "pubmed",
    async search(query: string, options: FederatedResearchOptions = {}): Promise<FederatedResearchResponse> {
      const startedAt = Date.now();
      const limit = Math.max(1, Math.min(options.maxResults ?? 6, 10));

      try {
        const searchUrl =
          `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=${limit}&term=${encodeURIComponent(
            query,
          )}`;

        const searchFetched = await fetchClient.fetchTextDetailed(searchUrl, 12000);
        if (!searchFetched.ok) {
          return failResponse(
            "pubmed",
            "pubmed",
            startedAt,
            normalizeFailureKind(searchFetched.errorKind),
            searchFetched.message,
            searchFetched.status,
          );
        }

        const searchJson = JSON.parse(searchFetched.body) as {
          esearchresult?: { idlist?: string[] };
        };

        const ids = searchJson.esearchresult?.idlist || [];
        if (!ids.length) {
          return okResponse("pubmed", "pubmed", [], startedAt, searchFetched.status, "PubMed returned zero ids");
        }

        const summaryUrl =
          `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`;

        const summaryFetched = await fetchClient.fetchTextDetailed(summaryUrl, 12000);
        if (!summaryFetched.ok) {
          return failResponse(
            "pubmed",
            "pubmed",
            startedAt,
            normalizeFailureKind(summaryFetched.errorKind),
            summaryFetched.message,
            summaryFetched.status,
          );
        }

        const summaryJson = JSON.parse(summaryFetched.body) as {
          result?: Record<
            string,
            {
              uid?: string;
              title?: string;
              pubdate?: string;
              source?: string;
              authors?: Array<{ name?: string }>;
            }
          > & { uids?: string[] };
        };

        const uids = summaryJson.result?.uids || [];
        const results: ResearchDocument[] = uids
          .map((uid) => {
            const row = summaryJson.result?.[uid];
            if (!row?.title) return null;

            const title = cleanText(row.title, 240);
            const snippet = cleanText(`${row.source || "PubMed"} ${row.pubdate || ""} ${title}`, 320);

            return {
              id: uid,
              title,
              snippet,
              provider: "pubmed",
              sourceType: "pubmed",
              url: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`,
              pmid: uid,
              publishedAt: row.pubdate,
              journal: row.source,
              authors: (row.authors || []).map((a) => a.name || "").filter(Boolean),
              trustScore: computeSourceTrustByType("pubmed"),
              freshnessScore: computeFreshnessScore(row.pubdate),
              relevanceScore: computeKeywordRelevance(query, title, snippet),
            } satisfies ResearchDocument;
          })
          .filter(Boolean) as ResearchDocument[];

        return okResponse("pubmed", "pubmed", results, startedAt, summaryFetched.status);
      } catch (error) {
        return failResponse(
          "pubmed",
          "pubmed",
          startedAt,
          "parse_error",
          error instanceof Error ? error.message : `${error}`,
        );
      }
    },
  };
}

export function createCrossrefProvider(): ResearchProvider {
  return {
    name: "crossref",
    sourceType: "crossref",
    async search(query: string, options: FederatedResearchOptions = {}): Promise<FederatedResearchResponse> {
      const startedAt = Date.now();
      const limit = Math.max(1, Math.min(options.maxResults ?? 6, 10));

      try {
        const url = `https://api.crossref.org/works?rows=${limit}&query=${encodeURIComponent(query)}`;
        const fetched = await fetchClient.fetchTextDetailed(url, 12000);

        if (!fetched.ok) {
          return failResponse(
            "crossref",
            "crossref",
            startedAt,
            normalizeFailureKind(fetched.errorKind),
            fetched.message,
            fetched.status,
          );
        }

        const json = JSON.parse(fetched.body) as {
          message?: {
            items?: Array<{
              DOI?: string;
              title?: string[];
              URL?: string;
              author?: Array<{ given?: string; family?: string }>;
              created?: { "date-time"?: string };
              issued?: { "date-parts"?: number[][] };
              "container-title"?: string[];
              "is-referenced-by-count"?: number;
            }>;
          };
        };

        const items = json.message?.items || [];
        const results: ResearchDocument[] = items
          .map((item) => {
            const title = cleanText(item.title?.[0] || "", 240);
            if (!title) return null;

            const publishedAt = item.created?.["date-time"] || item.issued?.["date-parts"]?.[0]?.join("-");
            const snippet = cleanText(
              `${item["container-title"]?.[0] || "Crossref"} ${publishedAt || ""} ${title}`,
              320,
            );

            return {
              title,
              snippet,
              provider: "crossref",
              sourceType: "crossref",
              url: item.URL,
              doi: item.DOI,
              publishedAt,
              journal: item["container-title"]?.[0],
              authors: (item.author || [])
                .map((a) => [a.given, a.family].filter(Boolean).join(" ").trim())
                .filter(Boolean),
              citationCount: item["is-referenced-by-count"],
              trustScore: computeSourceTrustByType("crossref"),
              freshnessScore: computeFreshnessScore(publishedAt),
              relevanceScore: computeKeywordRelevance(query, title, snippet),
            } satisfies ResearchDocument;
          })
          .filter(Boolean) as ResearchDocument[];

        return okResponse("crossref", "crossref", results, startedAt, fetched.status);
      } catch (error) {
        return failResponse(
          "crossref",
          "crossref",
          startedAt,
          "parse_error",
          error instanceof Error ? error.message : `${error}`,
        );
      }
    },
  };
}

export function createOpenAlexProvider(): ResearchProvider {
  return {
    name: "openalex",
    sourceType: "openalex",
    async search(query: string, options: FederatedResearchOptions = {}): Promise<FederatedResearchResponse> {
      const startedAt = Date.now();
      const limit = Math.max(1, Math.min(options.maxResults ?? 6, 10));

      try {
        const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${limit}`;
        const fetched = await fetchClient.fetchTextDetailed(url, 12000);

        if (!fetched.ok) {
          return failResponse(
            "openalex",
            "openalex",
            startedAt,
            normalizeFailureKind(fetched.errorKind),
            fetched.message,
            fetched.status,
          );
        }

        const json = JSON.parse(fetched.body) as {
          results?: Array<{
            id?: string;
            display_name?: string;
            publication_date?: string;
            cited_by_count?: number;
            doi?: string;
            primary_location?: { landing_page_url?: string; source?: { display_name?: string } };
            authorships?: Array<{ author?: { display_name?: string } }>;
          }>;
        };

        const items = json.results || [];
        const results: ResearchDocument[] = items
          .map((item) => {
            const title = cleanText(item.display_name || "", 240);
            if (!title) return null;

            const snippet = cleanText(
              `${item.primary_location?.source?.display_name || "OpenAlex"} ${item.publication_date || ""} ${title}`,
              320,
            );

            return {
              id: item.id,
              title,
              snippet,
              provider: "openalex",
              sourceType: "openalex",
              url: item.primary_location?.landing_page_url,
              doi: item.doi?.replace(/^https:\/\/doi\.org\//i, ""),
              publishedAt: item.publication_date,
              journal: item.primary_location?.source?.display_name,
              authors: (item.authorships || []).map((a) => a.author?.display_name || "").filter(Boolean),
              citationCount: item.cited_by_count,
              trustScore: computeSourceTrustByType("openalex"),
              freshnessScore: computeFreshnessScore(item.publication_date),
              relevanceScore: computeKeywordRelevance(query, title, snippet),
            } satisfies ResearchDocument;
          })
          .filter(Boolean) as ResearchDocument[];

        return okResponse("openalex", "openalex", results, startedAt, fetched.status);
      } catch (error) {
        return failResponse(
          "openalex",
          "openalex",
          startedAt,
          "parse_error",
          error instanceof Error ? error.message : `${error}`,
        );
      }
    },
  };
}

export function createArxivProvider(): ResearchProvider {
  return {
    name: "arxiv",
    sourceType: "arxiv",
    async search(query: string, options: FederatedResearchOptions = {}): Promise<FederatedResearchResponse> {
      const startedAt = Date.now();
      const limit = Math.max(1, Math.min(options.maxResults ?? 6, 10));

      try {
        const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(
          query,
        )}&start=0&max_results=${limit}`;

        const fetched = await fetchClient.fetchTextDetailed(url, 12000);
        if (!fetched.ok) {
          return failResponse(
            "arxiv",
            "arxiv",
            startedAt,
            normalizeFailureKind(fetched.errorKind),
            fetched.message,
            fetched.status,
          );
        }

        const xml = fetched.body;
        const entryBlocks = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)];

        const results: ResearchDocument[] = entryBlocks
          .map((match) => {
            const block = match?.[1] || "";
            const id = block.match(/<id>([\s\S]*?)<\/id>/i)?.[1]?.trim();
            const title = cleanText(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "", 240);
            const summary = cleanText(block.match(/<summary>([\s\S]*?)<\/summary>/i)?.[1] || "", 320);
            const publishedAt = block.match(/<published>([\s\S]*?)<\/published>/i)?.[1]?.trim();

            const authors = [...block.matchAll(/<name>([\s\S]*?)<\/name>/gi)]
              .map((m) => cleanText(m[1] || "", 120))
              .filter(Boolean);

            if (!title) return null;

            return {
              id,
              arxivId: id?.split("/").pop(),
              title,
              snippet: summary || title,
              provider: "arxiv",
              sourceType: "arxiv",
              url: id,
              publishedAt,
              authors,
              trustScore: computeSourceTrustByType("arxiv"),
              freshnessScore: computeFreshnessScore(publishedAt),
              relevanceScore: computeKeywordRelevance(query, title, summary || title),
            } satisfies ResearchDocument;
          })
          .filter(Boolean) as ResearchDocument[];

        return okResponse("arxiv", "arxiv", results, startedAt, fetched.status);
      } catch (error) {
        return failResponse(
          "arxiv",
          "arxiv",
          startedAt,
          "parse_error",
          error instanceof Error ? error.message : `${error}`,
        );
      }
    },
  };
}
