/**
 * Responsabilidade do arquivo:
 * - Executar busca web multi-provider com normalizacao de resultados.
 * - Limpar HTML/entities para reduzir ruido e mojibake em snippets.
 * - Entregar resultados deduplicados para o knowledge-layer.
 */
import { createFetchClient } from "./fetch-client";
import { webConfig } from "./web-config";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  provider: string;
  publishedAt?: string;
}

export interface SearchClient {
  search: (
    query: string,
    options?: {
      maxResults?: number;
      providers?: string[];
    },
  ) => Promise<SearchResult[]>;
}

const fetchClient = createFetchClient();

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, decimal) => {
      const code = Number(decimal);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " "));
}

function cleanText(value: string, max = 280): string {
  const cleaned = stripHtml(`${value || ""}`).replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}...`;
}

function normalizeResultUrl(rawUrl: string): string {
  const trimmed = `${rawUrl || ""}`.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed, "https://duckduckgo.com");
    if (parsed.hostname === "duckduckgo.com" && parsed.pathname.startsWith("/l/")) {
      const redirect = parsed.searchParams.get("uddg");
      if (redirect) return decodeURIComponent(redirect);
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

async function searchDuckDuckGoHtml(query: string, limit: number): Promise<SearchResult[]> {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await fetchClient.fetchText(url, webConfig.providerTimeoutMs);

  const titleMatches = [...html.matchAll(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const snippetMatches = [...html.matchAll(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)];
  const results: SearchResult[] = [];

  for (let index = 0; index < titleMatches.length && results.length < limit; index += 1) {
    const link = normalizeResultUrl(titleMatches[index]?.[1] || "");
    if (!link) continue;
    const title = cleanText(titleMatches[index]?.[2] || "");
    if (!title) continue;
    const snippet = cleanText(snippetMatches[index]?.[1] || snippetMatches[index]?.[2] || title);
    results.push({
      title,
      url: link,
      snippet,
      provider: "duckduckgo_html",
    });
  }

  return results;
}

async function searchBingHtml(query: string, limit: number): Promise<SearchResult[]> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  const html = await fetchClient.fetchText(url, webConfig.providerTimeoutMs);
  const blockMatches = [...html.matchAll(/<li[^>]*class="[^"]*b_algo[^"]*"[^>]*>([\s\S]*?)<\/li>/gi)];
  const results: SearchResult[] = [];

  for (const match of blockMatches) {
    if (results.length >= limit) break;
    const block = match?.[1] || "";
    const anchor = block.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!anchor?.[1] || !anchor?.[2]) continue;
    const link = normalizeResultUrl(anchor[1]);
    if (!link) continue;
    const title = cleanText(anchor[2]);
    if (!title) continue;
    const snippetMatch =
      block.match(/<p[^>]*>([\s\S]*?)<\/p>/i) ||
      block.match(/<div[^>]*class="[^"]*b_caption[^"]*"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
    const snippet = cleanText(snippetMatch?.[1] || title);
    results.push({
      title,
      url: link,
      snippet,
      provider: "bing_html",
    });
  }

  return results;
}

function chooseWikipediaLanguage(query: string): string {
  const normalized = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/\b(quem|qual|como|onde|hoje|atual)\b/.test(normalized)) {
    return "pt";
  }
  if (/\b(quien|cual|donde|hoy|actual)\b/.test(normalized)) return "es";
  return "en";
}

async function searchWikipediaApi(query: string, limit: number): Promise<SearchResult[]> {
  const lang = chooseWikipediaLanguage(query);
  const api = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query,
  )}&utf8=1&format=json&srlimit=${Math.max(1, Math.min(limit, 10))}`;
  const payload = await fetchClient.fetchText(api, webConfig.providerTimeoutMs);
  const parsed = JSON.parse(payload) as {
    query?: { search?: Array<{ title: string; snippet?: string; timestamp?: string }> };
  };
  const rows = parsed.query?.search || [];

  return rows.slice(0, limit).map((row) => ({
    title: cleanText(row.title, 180),
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(row.title.replace(/\s+/g, "_"))}`,
    snippet: cleanText(row.snippet || row.title),
    provider: "wikipedia_api",
    publishedAt: row.timestamp,
  }));
}

async function runProvider(provider: string, query: string, limit: number): Promise<SearchResult[]> {
  try {
    if (provider === "duckduckgo_html") return await searchDuckDuckGoHtml(query, limit);
    if (provider === "bing_html") return await searchBingHtml(query, limit);
    if (provider === "wikipedia_api") return await searchWikipediaApi(query, limit);
    return [];
  } catch {
    return [];
  }
}

function dedupeResults(results: SearchResult[], max: number): SearchResult[] {
  const byKey = new Map<string, SearchResult>();
  for (const result of results) {
    const key = `${result.url}`.toLowerCase();
    if (!key) continue;
    if (!byKey.has(key)) {
      byKey.set(key, result);
      continue;
    }
    const existing = byKey.get(key)!;
    const existingScore = existing.snippet.length + existing.title.length;
    const currentScore = result.snippet.length + result.title.length;
    if (currentScore > existingScore) {
      byKey.set(key, result);
    }
  }
  return Array.from(byKey.values()).slice(0, max);
}

export function createSearchClient(): SearchClient {
  return {
    async search(query, options = {}) {
      const normalized = `${query || ""}`.trim();
      if (!normalized) return [];

      const providers = (options.providers?.length ? options.providers : webConfig.providers)
        .map((provider) => provider.trim().toLowerCase())
        .filter(Boolean);
      const maxResults = Math.max(1, options.maxResults ?? webConfig.maxResults);
      const perProviderLimit = Math.max(2, Math.ceil(maxResults / Math.max(1, providers.length)) + 1);

      const all = await Promise.all(providers.map((provider) => runProvider(provider, normalized, perProviderLimit)));
      return dedupeResults(all.flat(), maxResults);
    },
  };
}

export const searchClientInfo = {
  providers: webConfig.providers,
};


