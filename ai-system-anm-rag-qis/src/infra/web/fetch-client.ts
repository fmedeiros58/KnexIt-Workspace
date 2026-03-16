export interface FetchClient {
  fetchText: (url: string, timeoutMs?: number) => Promise<string>;
}

export function createFetchClient(): FetchClient {
  return {
    async fetchText(url: string, timeoutMs = 9000) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.max(500, timeoutMs));

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "accept": "text/plain, text/html, application/json;q=0.9, */*;q=0.8",
            "user-agent": "anm-rag-qis/0.1",
          },
        });
        const text = await response.text();
        return text;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
