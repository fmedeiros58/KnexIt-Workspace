type InternetSearchResultItem = {
  title: string;
  url: string;
  snippet: string;
  isPdf: boolean;
};

export type InternetSearchResponse = {
  provider: "duckduckgo_html";
  query: string;
  elapsedMs: number;
  results: InternetSearchResultItem[];
};

type InternetSearchRequest = {
  query: string;
  preferPdf?: boolean;
};

type InternetSearchConfig = {
  enabled: boolean;
  timeoutMs: number;
  maxResults: number;
  cacheTtlMs: number;
  userAgent: string;
};

const DEFAULT_TIMEOUT_MS = 6_000;
const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_CACHE_TTL_MS = 30_000;
const DEFAULT_USER_AGENT = "knexit-rag/1.0 (+https://knexit.local)";

function parseBooleanFlag(value: string | undefined, fallback: boolean) {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parsePositiveInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function normalizeWhitespace(value: string) {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2F;/gi, "/");
}

function stripHtmlTags(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " "));
}

function normalizeUrl(value: string) {
  return `${value || ""}`.trim();
}

function extractDuckDuckGoTargetUrl(rawHref: string) {
  const href = normalizeUrl(decodeHtmlEntities(rawHref));
  if (!href) return "";

  const toAbsoluteDuckUrl = (candidate: string) => {
    if (!candidate) return "";
    if (candidate.startsWith("http://") || candidate.startsWith("https://")) return candidate;
    if (candidate.startsWith("//")) return `https:${candidate}`;
    if (candidate.startsWith("/")) return `https://duckduckgo.com${candidate}`;
    return candidate;
  };

  const absolute = toAbsoluteDuckUrl(href);
  if (!absolute) return "";

  try {
    const parsed = new URL(absolute);
    if (parsed.hostname.endsWith("duckduckgo.com") && parsed.pathname.startsWith("/l/")) {
      const target = parsed.searchParams.get("uddg") || parsed.searchParams.get("rut") || "";
      const decodedTarget = target ? decodeURIComponent(target) : "";
      if (!decodedTarget) return "";
      const normalizedTarget = normalizeUrl(decodedTarget);
      if (!/^https?:\/\//i.test(normalizedTarget)) return "";
      return normalizedTarget;
    }
    if (!/^https?:\/\//i.test(parsed.toString())) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function isPdfUrl(url: string) {
  const normalized = `${url || ""}`.toLowerCase();
  return normalized.endsWith(".pdf") || normalized.includes(".pdf?") || normalized.includes("filetype=pdf");
}

function parseDuckDuckGoHtml(html: string, maxResults: number) {
  const results: InternetSearchResultItem[] = [];
  const seen = new Set<string>();
  const anchorRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null = null;
  while ((match = anchorRegex.exec(html)) && results.length < maxResults) {
    const rawHref = match[1] || "";
    const titleRaw = match[2] || "";
    const url = extractDuckDuckGoTargetUrl(rawHref);
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const nearby = html.slice(match.index, Math.min(html.length, match.index + 1400));
    const snippetMatch = nearby.match(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div|span)>/i);
    const title = normalizeWhitespace(stripHtmlTags(titleRaw));
    const snippet = normalizeWhitespace(stripHtmlTags(snippetMatch?.[1] || ""));
    if (!title && !snippet) continue;

    results.push({
      title: title || snippet || url,
      url,
      snippet,
      isPdf: isPdfUrl(url),
    });
  }
  return results;
}

function sanitizeQuery(value: string) {
  return normalizeWhitespace(value).slice(0, 280);
}

function applyPdfHint(query: string, preferPdf: boolean) {
  if (!preferPdf) return query;
  if (/\b(filetype:pdf|pdf)\b/i.test(query)) return query;
  return `${query} filetype:pdf`;
}

function buildConfig(raw: NodeJS.ProcessEnv = process.env): InternetSearchConfig {
  return {
    enabled: parseBooleanFlag(raw.RAG_WEB_SEARCH_ENABLED, true),
    timeoutMs: parsePositiveInt(raw.RAG_WEB_SEARCH_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1_000, 20_000),
    maxResults: parsePositiveInt(raw.RAG_WEB_SEARCH_MAX_RESULTS, DEFAULT_MAX_RESULTS, 1, 10),
    cacheTtlMs: parsePositiveInt(raw.RAG_WEB_SEARCH_CACHE_TTL_MS, DEFAULT_CACHE_TTL_MS, 0, 300_000),
    userAgent: normalizeWhitespace(raw.RAG_WEB_SEARCH_USER_AGENT || "") || DEFAULT_USER_AGENT,
  };
}

export class RagInternetSearchService {
  private readonly config: InternetSearchConfig;
  private readonly cache = new Map<string, { expiresAt: number; payload: InternetSearchResponse }>();

  constructor(rawEnv: NodeJS.ProcessEnv = process.env) {
    this.config = buildConfig(rawEnv);
  }

  isEnabled() {
    return this.config.enabled;
  }

  private getCacheKey(request: InternetSearchRequest) {
    return `${sanitizeQuery(request.query).toLowerCase()}|${request.preferPdf ? "pdf" : "all"}`;
  }

  private getCached(request: InternetSearchRequest) {
    if (this.config.cacheTtlMs <= 0) return null;
    const now = Date.now();
    const key = this.getCacheKey(request);
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (cached.expiresAt <= now) {
      this.cache.delete(key);
      return null;
    }
    return cached.payload;
  }

  private setCached(request: InternetSearchRequest, payload: InternetSearchResponse) {
    if (this.config.cacheTtlMs <= 0) return;
    const key = this.getCacheKey(request);
    this.cache.set(key, { expiresAt: Date.now() + this.config.cacheTtlMs, payload });
  }

  private async fetchDuckDuckGoResults(query: string, preferPdf: boolean) {
    const effectiveQuery = applyPdfHint(sanitizeQuery(query), preferPdf);
    if (!effectiveQuery) return [];

    const endpoint = `https://duckduckgo.com/html/?q=${encodeURIComponent(effectiveQuery)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "User-Agent": this.config.userAgent,
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if (!response.ok) return [];
      const html = await response.text();
      const parsed = parseDuckDuckGoHtml(html, this.config.maxResults);
      if (!parsed.length) return [];

      if (!preferPdf) return parsed.slice(0, this.config.maxResults);
      const sorted = [...parsed].sort((left, right) => Number(right.isPdf) - Number(left.isPdf));
      return sorted.slice(0, this.config.maxResults);
    } catch {
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async search(request: InternetSearchRequest): Promise<InternetSearchResponse | null> {
    if (!this.config.enabled) return null;
    const query = sanitizeQuery(request.query);
    if (!query) return null;

    const cached = this.getCached({ query, preferPdf: request.preferPdf });
    if (cached) return cached;

    const startedAt = Date.now();
    let results = await this.fetchDuckDuckGoResults(query, request.preferPdf === true);
    if (!results.length && request.preferPdf) {
      results = await this.fetchDuckDuckGoResults(query, false);
    }
    if (!results.length) return null;

    const payload: InternetSearchResponse = {
      provider: "duckduckgo_html",
      query,
      elapsedMs: Date.now() - startedAt,
      results: results.slice(0, this.config.maxResults),
    };
    this.setCached({ query, preferPdf: request.preferPdf }, payload);
    return payload;
  }
}

export function createRagInternetSearchService(rawEnv: NodeJS.ProcessEnv = process.env) {
  return new RagInternetSearchService(rawEnv);
}
