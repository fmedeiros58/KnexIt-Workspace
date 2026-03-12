import { RagInternetSearchService } from "@/core/rag/internet-search-service";

describe("RagInternetSearchService redundancy", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("retries with relaxed query when provider gets empty constrained results", async () => {
    const fetchMock = jest.fn(async (input: URL | RequestInfo) => {
      const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const parsed = new URL(rawUrl);
      const query = parsed.searchParams.get("q") || "";
      const constrained = query.includes("site:gov.br");

      if (constrained) {
        return new Response("<html><body>no results</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }

      return new Response(
        `<html><body>
          <a class="result__a" href="https://www.ac.gov.br/governo">Governo do Acre</a>
          <div class="result__snippet">Titular atual: Gladson Cameli.</div>
        </body></html>`,
        {
          status: 200,
          headers: { "Content-Type": "text/html" },
        },
      );
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const service = new RagInternetSearchService({
      ...process.env,
      RAG_WEB_SEARCH_ENABLED: "1",
      RAG_WEB_SEARCH_PROVIDERS: "duckduckgo_html",
      RAG_WEB_SEARCH_MAX_RESULTS: "1",
      RAG_WEB_SEARCH_CACHE_TTL_MS: "0",
      RAG_WEB_SEARCH_TIMEOUT_MS: "3000",
    });

    const response = await service.search({
      query: "governador do acre site:gov.br",
      preferPdf: false,
    });

    expect(response).not.toBeNull();
    expect(response?.results.length).toBeGreaterThan(0);
    expect(response?.results[0]?.url).toContain("ac.gov.br");

    const fetchedQueries = fetchMock.mock.calls
      .map(([input]) => {
        const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        return new URL(rawUrl).searchParams.get("q") || "";
      })
      .filter(Boolean);

    expect(fetchedQueries.some((query) => query.includes("site:gov.br"))).toBe(true);
    expect(fetchedQueries.some((query) => query === "governador do acre")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

