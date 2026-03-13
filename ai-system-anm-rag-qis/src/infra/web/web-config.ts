export interface WebConfig {
  providers: string[];
  timeoutMs: number;
}

export const webConfig: WebConfig = {
  providers: ["duckduckgo_html", "bing_html", "wikipedia_api"],
  timeoutMs: Number(process.env.ANM_WEB_TIMEOUT_MS || 8000),
};
