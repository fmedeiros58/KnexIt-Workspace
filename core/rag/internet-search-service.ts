type InternetSearchResultItem = {
  title: string;
  url: string;
  snippet: string;
  isPdf: boolean;
};

type SearchProvider = "duckduckgo_html" | "bing_html" | "wikipedia_api";

export type InternetSearchResponse = {
  provider: SearchProvider | "multi";
  providersUsed: SearchProvider[];
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
  providers: SearchProvider[];
};

const DEFAULT_TIMEOUT_MS = 6_000;
const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_CACHE_TTL_MS = 30_000;
const DEFAULT_USER_AGENT = "knexit-rag/1.0 (+https://knexit.local)";
const DEFAULT_PROVIDERS: SearchProvider[] = ["duckduckgo_html", "bing_html", "wikipedia_api"];

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

const SEARCH_PREAMBLE_STOPWORDS = new Set([
  "a",
  "as",
  "atual",
  "current",
  "d",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "eh",
  "is",
  "me",
  "nome",
  "o",
  "of",
  "os",
  "por",
  "pra",
  "qual",
  "que",
  "quem",
  "saber",
  "the",
]);

function normalizeFold(value: string) {
  return normalizeWhitespace(`${value || ""}`)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function hasMeaningfulSearchScope(value: string) {
  const normalized = normalizeFold(value);
  if (!normalized) return false;
  if (
    /\b(presidente|prefeito|governador|ministro|reitor|ceo|rector|chancellor|usa|eua|united states|estados unidos|brasil|brazil|acre)\b/.test(
      normalized,
    )
  ) {
    return true;
  }
  const tokens = normalized
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !SEARCH_PREAMBLE_STOPWORDS.has(token));
  return tokens.length >= 2;
}

function stripQuestionPreamble(value: string) {
  let output = normalizeWhitespace(value);
  if (!output) return "";
  const patterns = [
    /^(?:por favor[,:\s-]*)?(?:preciso|quero|gostaria)\s+que\s+(?:voce|vc)\s+(?:me\s+)?(?:diga|informe|responda)\s+/i,
    /^(?:por favor[,:\s-]*)?(?:preciso|quero|gostaria)\s+que\s+(?:me\s+)?(?:diga|informe|responda)\s+/i,
    /^(?:por favor[,:\s-]*)?(?:preciso|quero|gostaria)\s+que\s+(?:voce|vc)\s+(?:me\s+)?d(?:e|ê)\s+o\s+nome\s+(?:do|da|de)\s+/i,
    /^(?:por favor[,:\s-]*)?(?:preciso|quero|gostaria)\s+que\s+(?:me\s+)?d(?:e|ê)\s+o\s+nome\s+(?:do|da|de)\s+/i,
    /^(?:por favor[,:\s-]*)?(?:preciso|quero|gostaria)\s+saber\s+(?:o\s+nome\s+)?(?:do|da|de)\s+/i,
    /^(?:por favor[,:\s-]*)?(?:voce|vc)\s+pode\s+(?:me\s+)?(?:dizer|informar|responder)\s+/i,
    /^(?:por favor[,:\s-]*)?pode\s+(?:me\s+)?(?:dizer|informar|responder)\s+/i,
    /^(?:por favor[,:\s-]*)?me\s+(?:diga|informe|responda)\s+/i,
    /^(?:qual\s+(?:e|eh|é)\s+(?:o|a)\s+nome\s+(?:do|da|de)\s+)/i,
    /^(?:qual\s+o\s+nome\s+(?:do|da|de)\s+)/i,
    /^(?:quem\s+(?:e|eh|é)\s+(?:o|a)\s+)/i,
  ];
  for (const pattern of patterns) {
    output = output.replace(pattern, "");
  }
  const stripped = normalizeWhitespace(output);
  if (!stripped) return "";
  return hasMeaningfulSearchScope(stripped) ? stripped : normalizeWhitespace(value);
}
function stripSearchOperators(value: string) {
  return normalizeWhitespace(
    `${value || ""}`
      .replace(/\bsite:[^\s]+/gi, " ")
      .replace(/\bfiletype:[^\s]+/gi, " ")
      .replace(/\bintitle:[^\s]+/gi, " ")
      .replace(/\binurl:[^\s]+/gi, " "),
  );
}

function buildRelaxedProviderQuery(query: string) {
  const original = sanitizeQuery(query);
  if (!original) return "";
  const relaxed = sanitizeQuery(stripSearchOperators(stripQuestionPreamble(original)));
  if (!relaxed) return "";
  if (relaxed.toLowerCase() === original.toLowerCase()) return "";
  return relaxed;
}

function buildRedundantQueries(query: string) {
  const base = sanitizeQuery(query);
  if (!base) return [];
  const stripped = stripQuestionPreamble(base);
  const withoutOperators = stripSearchOperators(stripped || base);
  const compact = normalizeWhitespace(withoutOperators.replace(/[!?.,;:()"']/g, " "));
  const variants: string[] = [];
  const seen = new Set<string>();
  const push = (candidate: string) => {
    const normalized = sanitizeQuery(candidate).toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    variants.push(sanitizeQuery(candidate));
  };
  push(base);
  push(stripped);
  push(withoutOperators);
  push(compact);
  return variants;
}

const SEARCH_TOKEN_STOPWORDS = new Set([
  "qual",
  "quem",
  "nome",
  "atual",
  "current",
  "the",
  "of",
  "do",
  "da",
  "de",
  "dos",
  "das",
  "is",
  "e",
  "o",
  "a",
  "os",
  "as",
]);

function buildRankingTokens(query: string) {
  const base = stripQuestionPreamble(stripSearchOperators(query));
  const normalized = normalizeWhitespace(base)
    .toLowerCase()
    .replace(/[!?.,;:()"']/g, " ");
  return Array.from(
    new Set(
      normalized
        .split(/[^a-z0-9à-ÿ]+/g)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3 && !SEARCH_TOKEN_STOPWORDS.has(token)),
    ),
  ).slice(0, 8);
}

function scoreResultForQuery(result: InternetSearchResultItem, queryTokens: string[]) {
  const haystack = normalizeWhitespace(`${result.title || ""} ${result.snippet || ""} ${result.url || ""}`).toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) score += 3;
  }
  const url = `${result.url || ""}`.toLowerCase();
  if (url.includes("wikipedia.org/wiki/")) score += 2;
  if (/\b(titular atual|incumbente|incumbent|desde)\b/i.test(result.snippet || "")) score += 4;
  if (url.includes(".gov") || url.includes(".gov.br")) score += 3;
  if (isLowSignalDomain(url)) score -= 5;
  if (result.isPdf) score += 1;
  return score;
}

function buildWikipediaQueryVariants(query: string) {
  const base = sanitizeQuery(query);
  if (!base) return [];
  const stripped = stripQuestionPreamble(base);
  const variants: string[] = [];
  const seen = new Set<string>();
  const push = (candidate: string) => {
    const normalized = sanitizeQuery(candidate).toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    variants.push(sanitizeQuery(candidate));
  };
  push(base);
  push(stripped);

  const officeMatch = stripped.match(/\b(governador|prefeito|presidente|ministro|reitor)\s+(?:do|da|de)\s+(.+)$/i);
  if (officeMatch) {
    const office = officeMatch[1].toLowerCase();
    const scope = normalizeWhitespace(officeMatch[2] || "");
    if (scope) {
      const pluralOffice =
        office === "governador"
          ? "governadores"
          : office === "prefeito"
            ? "prefeitos"
            : office === "presidente"
              ? "presidentes"
              : office === "ministro"
                ? "ministros"
                : "reitores";
      push(`lista de ${pluralOffice} do ${scope}`);
      push(`${office} do ${scope}`);
    }
  }
  return variants;
}

function pickWikipediaLanguages(query: string) {
  const normalized = normalizeWhitespace(query).toLowerCase();
  if (!normalized) return ["en", "pt"] as const;
  const seemsPortuguese =
    /\b(qual|quem|governador|prefeito|presidente|ministro|reitor|estado|brasil|acre|nome)\b/.test(normalized);
  return seemsPortuguese ? (["pt", "en"] as const) : (["en", "pt"] as const);
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

function isLowSignalDomain(url: string) {
  let hostname = "";
  try {
    hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }
  if (!hostname) return false;
  return (
    hostname.includes("dicio.com.br") ||
    hostname.includes("sinonimos.com.br") ||
    hostname.includes("dicionario.priberam.org") ||
    hostname.includes("dicionario.info") ||
    hostname.includes("portuguesaletra.com")
  );
}

function decodeBase64Url(value: string) {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return "";
  }
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

function extractBingTargetUrl(rawHref: string) {
  const href = normalizeUrl(decodeHtmlEntities(rawHref));
  if (!href) return "";

  const toAbsolute = (candidate: string) => {
    if (!candidate) return "";
    if (candidate.startsWith("http://") || candidate.startsWith("https://")) return candidate;
    if (candidate.startsWith("//")) return `https:${candidate}`;
    if (candidate.startsWith("/")) return `https://www.bing.com${candidate}`;
    return candidate;
  };

  const absolute = toAbsolute(href);
  if (!absolute) return "";

  try {
    const parsed = new URL(absolute);
    if (parsed.hostname.endsWith("bing.com") && parsed.pathname.startsWith("/ck/a")) {
      const encoded = parsed.searchParams.get("u") || parsed.searchParams.get("r") || "";
      if (encoded) {
        const raw = encoded.startsWith("a1") ? encoded.slice(2) : encoded;
        const decodedUrl = decodeBase64Url(raw);
        if (/^https?:\/\//i.test(decodedUrl)) return normalizeUrl(decodedUrl);
        const decodedQuery = decodeURIComponent(raw);
        if (/^https?:\/\//i.test(decodedQuery)) return normalizeUrl(decodedQuery);
      }
      // Ignora links de rastreamento do Bing quando nao foi possivel extrair o alvo real.
      return "";
    }
    if (!/^https?:\/\//i.test(parsed.toString())) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function parseBingHtml(html: string, maxResults: number) {
  const results: InternetSearchResultItem[] = [];
  const seen = new Set<string>();
  const blockRegex = /<li[^>]*class="[^"]*\bb_algo\b[^"]*"[\s\S]*?<\/li>/gi;
  let blockMatch: RegExpExecArray | null = null;
  while ((blockMatch = blockRegex.exec(html)) && results.length < maxResults) {
    const block = blockMatch[0] || "";
    const anchorMatch = block.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!anchorMatch) continue;
    const url = extractBingTargetUrl(anchorMatch[1] || "");
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);

    const title = normalizeWhitespace(stripHtmlTags(anchorMatch[2] || ""));
    const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
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

function parseBingRss(xml: string, maxResults: number) {
  const results: InternetSearchResultItem[] = [];
  const seen = new Set<string>();
  const itemRegex = /<item\b[\s\S]*?<\/item>/gi;
  let itemMatch: RegExpExecArray | null = null;
  while ((itemMatch = itemRegex.exec(xml)) && results.length < maxResults) {
    const item = itemMatch[0] || "";
    const title = normalizeWhitespace(stripHtmlTags((item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "").trim()));
    const rawUrl = normalizeUrl(decodeHtmlEntities((item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || "").trim()));
    const url = extractBingTargetUrl(rawUrl) || rawUrl;
    const snippet = normalizeWhitespace(
      stripHtmlTags((item.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || "").trim()),
    );
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
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

function parseWikipediaOpenSearch(payload: unknown, maxResults: number) {
  if (!Array.isArray(payload) || payload.length < 4) return [];
  const titles = Array.isArray(payload[1]) ? payload[1] : [];
  const snippets = Array.isArray(payload[2]) ? payload[2] : [];
  const urls = Array.isArray(payload[3]) ? payload[3] : [];
  const results: InternetSearchResultItem[] = [];
  for (let i = 0; i < Math.min(maxResults, urls.length); i += 1) {
    const url = normalizeUrl(`${urls[i] || ""}`);
    if (!/^https?:\/\//i.test(url)) continue;
    const title = normalizeWhitespace(`${titles[i] || ""}`);
    const snippet = normalizeWhitespace(`${snippets[i] || ""}`);
    results.push({
      title: title || snippet || url,
      url,
      snippet,
      isPdf: isPdfUrl(url),
    });
  }
  return results;
}

function extractWikipediaTitleFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("wikipedia.org")) return "";
    const prefix = "/wiki/";
    const index = parsed.pathname.indexOf(prefix);
    if (index < 0) return "";
    const rawTitle = parsed.pathname.slice(index + prefix.length);
    return decodeURIComponent(rawTitle || "").trim();
  } catch {
    return "";
  }
}

function stripWikipediaMarkup(value: string) {
  let output = `${value || ""}`;
  output = output.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, " ");
  output = output.replace(/<[^>]+>/g, " ");
  output = output.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2");
  output = output.replace(/\[\[([^\]]+)\]\]/g, "$1");
  output = output.replace(/\{\{[^{}]*\}\}/g, " ");
  output = output.replace(/''+/g, "");
  output = output.replace(/\|/g, " ");
  return normalizeWhitespace(output);
}

function extractOfficeHolderSnippetFromWikiText(wikiText: string) {
  const raw = `${wikiText || ""}`;
  if (!raw) return "";
  const holderPatterns = [
    /\|\s*incumbente\s*=\s*([^\n]+)/i,
    /\|\s*incumbent\s*=\s*([^\n]+)/i,
    /\|\s*titular\s*=\s*([^\n]+)/i,
    /\|\s*prefeito(?:a)?\s*=\s*([^\n]+)/i,
    /\|\s*governador(?:a)?\s*=\s*([^\n]+)/i,
    /\|\s*presidente\s*=\s*([^\n]+)/i,
    /\|\s*mayor\s*=\s*([^\n]+)/i,
    /\|\s*governor\s*=\s*([^\n]+)/i,
  ];
  for (const pattern of holderPatterns) {
    const match = raw.match(pattern);
    const holder = stripWikipediaMarkup(match?.[1] || "");
    if (holder) return `Titular atual: ${holder}.`;
  }
  const sentenceMatch =
    raw.match(/\b(?:o|a)\s+atual\s+(?:governador|prefeito|presidente|ministro|reitor)\b[^.\n]{0,140}[.\n]/i) ||
    raw.match(/\b(?:governador|prefeito|presidente|ministro|reitor)\s+atual\b[^.\n]{0,140}[.\n]/i);
  const sentence = stripWikipediaMarkup(sentenceMatch?.[0] || "");
  return sentence;
}

function sanitizeQuery(value: string) {
  return normalizeWhitespace(value).slice(0, 280);
}

function applyPdfHint(query: string, preferPdf: boolean) {
  if (!preferPdf) return query;
  if (/\b(filetype:pdf|pdf)\b/i.test(query)) return query;
  return `${query} filetype:pdf`;
}

function parseProviders(rawValue: string | undefined) {
  const raw = `${rawValue || ""}`.trim().toLowerCase();
  if (!raw) return [...DEFAULT_PROVIDERS];

  const mapped: SearchProvider[] = [];
  const seen = new Set<SearchProvider>();
  const tokens = raw.split(/[,\s;|]+/g).map((token) => token.trim()).filter(Boolean);
  for (const token of tokens) {
    let provider: SearchProvider | null = null;
    if (token === "ddg" || token === "duckduckgo" || token === "duckduckgo_html") provider = "duckduckgo_html";
    if (token === "bing" || token === "bing_html") provider = "bing_html";
    if (token === "wikipedia" || token === "wiki" || token === "wikipedia_api") provider = "wikipedia_api";
    if (!provider || seen.has(provider)) continue;
    seen.add(provider);
    mapped.push(provider);
  }
  return mapped.length ? mapped : [...DEFAULT_PROVIDERS];
}

function buildConfig(raw: NodeJS.ProcessEnv = process.env): InternetSearchConfig {
  return {
    enabled: parseBooleanFlag(raw.RAG_WEB_SEARCH_ENABLED, true),
    timeoutMs: parsePositiveInt(raw.RAG_WEB_SEARCH_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1_000, 20_000),
    maxResults: parsePositiveInt(raw.RAG_WEB_SEARCH_MAX_RESULTS, DEFAULT_MAX_RESULTS, 1, 10),
    cacheTtlMs: parsePositiveInt(raw.RAG_WEB_SEARCH_CACHE_TTL_MS, DEFAULT_CACHE_TTL_MS, 0, 300_000),
    userAgent: normalizeWhitespace(raw.RAG_WEB_SEARCH_USER_AGENT || "") || DEFAULT_USER_AGENT,
    providers: parseProviders(raw.RAG_WEB_SEARCH_PROVIDERS),
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

  private async fetchBingResults(query: string, preferPdf: boolean) {
    const effectiveQuery = applyPdfHint(sanitizeQuery(query), preferPdf);
    if (!effectiveQuery) return [];

    const rssEndpoint = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(effectiveQuery)}&setlang=en-us`;
    const htmlEndpoint = `https://www.bing.com/search?q=${encodeURIComponent(effectiveQuery)}&setlang=en-us`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const rssResponse = await fetch(rssEndpoint, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "User-Agent": this.config.userAgent,
          Accept: "application/rss+xml,application/xml,text/xml",
        },
      });
      const rss = rssResponse.ok ? await rssResponse.text() : "";
      let parsed = parseBingRss(rss, this.config.maxResults);
      if (!parsed.length) {
        const htmlResponse = await fetch(htmlEndpoint, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
          headers: {
            "User-Agent": this.config.userAgent,
            Accept: "text/html,application/xhtml+xml",
          },
        });
        if (!htmlResponse.ok) return [];
        const html = await htmlResponse.text();
        parsed = parseBingHtml(html, this.config.maxResults);
      }
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

  private async fetchWikipediaOpenSearch(language: "en" | "pt", query: string) {
    const endpoint =
      `https://${language}.wikipedia.org/w/api.php?action=opensearch&format=json&namespace=0&limit=${this.config.maxResults}` +
      `&search=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "User-Agent": this.config.userAgent,
          Accept: "application/json",
        },
      });
      if (!response.ok) return [];
      const payload = (await response.json()) as unknown;
      return parseWikipediaOpenSearch(payload, this.config.maxResults);
    } catch {
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async fetchWikipediaWikitextSnippet(url: string) {
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.endsWith("wikipedia.org")) return "";
      const language = parsed.hostname.startsWith("pt.") ? "pt" : "en";
      const title = extractWikipediaTitleFromUrl(url);
      if (!title) return "";
      const endpoint =
        `https://${language}.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main` +
        `&formatversion=2&format=json&titles=${encodeURIComponent(title)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
      try {
        const response = await fetch(endpoint, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
          headers: {
            "User-Agent": this.config.userAgent,
            Accept: "application/json",
          },
        });
        if (!response.ok) return "";
        const payload = (await response.json()) as {
          query?: { pages?: Array<{ revisions?: Array<{ slots?: { main?: { content?: string } } }> }> };
        };
        const wikiText = payload?.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content || "";
        return extractOfficeHolderSnippetFromWikiText(wikiText);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      return "";
    }
  }

  private async fetchWikipediaResults(query: string) {
    const effectiveQuery = sanitizeQuery(query);
    if (!effectiveQuery) return [];

    const queries = buildWikipediaQueryVariants(effectiveQuery).slice(0, 4);
    const languages = pickWikipediaLanguages(effectiveQuery);
    const jobs: Array<Promise<InternetSearchResultItem[]>> = [];
    for (const language of languages) {
      for (const currentQuery of queries) {
        jobs.push(this.fetchWikipediaOpenSearch(language, currentQuery));
      }
    }
    const settled = await Promise.allSettled(jobs);
    const merged: InternetSearchResultItem[] = [];
    const indexByUrl = new Map<string, number>();
    for (const result of settled) {
      if (result.status !== "fulfilled") continue;
      for (const row of result.value) {
        const url = normalizeUrl(row.url);
        if (!url) continue;
        const previousIndex = indexByUrl.get(url);
        if (previousIndex !== undefined) {
          const previous = merged[previousIndex];
          const shouldReplace = (previous.snippet || "").length < (row.snippet || "").length;
          if (shouldReplace) {
            merged[previousIndex] = { ...previous, ...row, url };
          }
          continue;
        }
        indexByUrl.set(url, merged.length);
        merged.push({ ...row, url });
        if (merged.length >= this.config.maxResults * 3) break;
      }
      if (merged.length >= this.config.maxResults * 3) break;
    }
    if (!merged.length) return [];

    const enrichTargets = merged.filter((row) => row.url.includes("wikipedia.org") && row.snippet.length < 24).slice(0, 3);
    if (enrichTargets.length) {
      const snippets = await Promise.all(
        enrichTargets.map(async (row) => ({
          url: row.url,
          snippet: await this.fetchWikipediaWikitextSnippet(row.url),
        })),
      );
      const snippetByUrl = new Map(snippets.filter((row) => row.snippet).map((row) => [row.url, row.snippet]));
      for (let index = 0; index < merged.length; index += 1) {
        const row = merged[index];
        const enrichedSnippet = snippetByUrl.get(row.url);
        if (!enrichedSnippet) continue;
        merged[index] = { ...row, snippet: enrichedSnippet };
      }
    }
    return merged.slice(0, this.config.maxResults);
  }

  private async fetchProviderResults(provider: SearchProvider, query: string, preferPdf: boolean) {
    const relaxedQuery = buildRelaxedProviderQuery(query);
    if (provider === "duckduckgo_html") {
      let results = await this.fetchDuckDuckGoResults(query, preferPdf);
      if (!results.length && preferPdf) {
        results = await this.fetchDuckDuckGoResults(query, false);
      }
      if (!results.length && relaxedQuery) {
        results = await this.fetchDuckDuckGoResults(relaxedQuery, preferPdf);
      }
      if (!results.length && relaxedQuery && preferPdf) {
        results = await this.fetchDuckDuckGoResults(relaxedQuery, false);
      }
      return results;
    }

    if (provider === "bing_html") {
      let results = await this.fetchBingResults(query, preferPdf);
      if (!results.length && preferPdf) {
        results = await this.fetchBingResults(query, false);
      }
      if (!results.length && relaxedQuery) {
        results = await this.fetchBingResults(relaxedQuery, preferPdf);
      }
      if (!results.length && relaxedQuery && preferPdf) {
        results = await this.fetchBingResults(relaxedQuery, false);
      }
      return results;
    }

    let results = await this.fetchWikipediaResults(query);
    if (!results.length && relaxedQuery) {
      results = await this.fetchWikipediaResults(relaxedQuery);
    }
    return results;
  }

  private async runProviderSweep(query: string, preferPdf: boolean) {
    return Promise.all(
      this.config.providers.map(async (provider) => ({
        provider,
        results: await this.fetchProviderResults(provider, query, preferPdf),
      })),
    );
  }

  async search(request: InternetSearchRequest): Promise<InternetSearchResponse | null> {
    if (!this.config.enabled) return null;
    const query = sanitizeQuery(request.query);
    if (!query) return null;

    const cached = this.getCached({ query, preferPdf: request.preferPdf });
    if (cached) return cached;

    const startedAt = Date.now();
    const preferPdf = request.preferPdf === true;
    const providersUsed = new Set<SearchProvider>();
    const indexByUrl = new Map<string, number>();
    const merged: InternetSearchResultItem[] = [];
    const redundancyQueries = buildRedundantQueries(query).slice(0, 4);
    for (const redundancyQuery of redundancyQueries) {
      const providerEntries = await this.runProviderSweep(redundancyQuery, preferPdf);
      for (const entry of providerEntries) {
        if (entry.results.length) providersUsed.add(entry.provider);
        for (const result of entry.results) {
          const url = normalizeUrl(result.url);
          if (!url) continue;
          const previousIndex = indexByUrl.get(url);
          if (previousIndex !== undefined) {
            const previous = merged[previousIndex];
            const shouldReplace = (previous.snippet || "").length < (result.snippet || "").length;
            if (shouldReplace) {
              merged[previousIndex] = { ...previous, ...result, url };
            }
            continue;
          }
          indexByUrl.set(url, merged.length);
          merged.push({ ...result, url });
        }
      }
      const hasMinimalCoverage = merged.length >= Math.min(3, this.config.maxResults);
      const hasMultiProvider = providersUsed.size >= Math.min(2, this.config.providers.length);
      if (hasMinimalCoverage && hasMultiProvider) break;
    }
    if (!merged.length) return null;

    const rankingTokens = buildRankingTokens(query);
    const rankedByQuery = [...merged].sort(
      (left, right) => scoreResultForQuery(right, rankingTokens) - scoreResultForQuery(left, rankingTokens),
    );
    const ranked = preferPdf
      ? [...rankedByQuery].sort(
          (left, right) =>
            Number(right.isPdf) - Number(left.isPdf) ||
            scoreResultForQuery(right, rankingTokens) - scoreResultForQuery(left, rankingTokens),
        )
      : rankedByQuery;
    const highSignalRanked = ranked.filter((row) => !isLowSignalDomain(row.url));
    const effectiveRanked = highSignalRanked.length ? highSignalRanked : ranked;
    const limited = effectiveRanked.slice(0, this.config.maxResults);
    const provider: InternetSearchResponse["provider"] =
      providersUsed.size > 1
        ? "multi"
        : Array.from(providersUsed)[0] || this.config.providers[0] || "duckduckgo_html";

    const payload: InternetSearchResponse = {
      provider,
      providersUsed: Array.from(providersUsed),
      query,
      elapsedMs: Date.now() - startedAt,
      results: limited,
    };
    this.setCached({ query, preferPdf: request.preferPdf }, payload);
    return payload;
  }
}

export function createRagInternetSearchService(rawEnv: NodeJS.ProcessEnv = process.env) {
  return new RagInternetSearchService(rawEnv);
}


