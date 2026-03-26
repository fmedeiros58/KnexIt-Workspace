export interface WebConfig {
  providers: string[];
  timeoutMs: number;
  maxResults: number;
  providerTimeoutMs: number;
}

function parseProviders(value: string): string[] {
  const defaults = ["wikipedia_api", "bing_html", "duckduckgo_html"];
  const parsed = `${value || ""}`
    .split(/[,\s;]+/g)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return parsed.length ? [...new Set(parsed)] : defaults;
}

export const webConfig: WebConfig = {
  providers: parseProviders(process.env.RAG_WEB_SEARCH_PROVIDERS || process.env.ANM_WEB_PROVIDERS || ""),
  timeoutMs: Math.max(1200, Number(process.env.ANM_WEB_TIMEOUT_MS || 8000)),
  maxResults: Math.max(2, Number(process.env.KNEXAI_AUTO_WEB_SEARCH_MAX_RESULTS || 8)),
  providerTimeoutMs: Math.max(1200, Number(process.env.ANM_WEB_PROVIDER_TIMEOUT_MS || 12000)),
};
