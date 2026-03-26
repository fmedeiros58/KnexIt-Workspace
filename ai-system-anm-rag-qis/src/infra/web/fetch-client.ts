export interface FetchClient {
  fetchText: (url: string, timeoutMs?: number) => Promise<string>;
  fetchTextDetailed: (url: string, timeoutMs?: number) => Promise<FetchTextDetailedResult>;
}

export type FetchErrorKind =
  | "timeout"
  | "network_error"
  | "http_error"
  | "parse_error"
  | "unknown_error";

export interface FetchTextDetailedResult {
  ok: boolean;
  url: string;
  status?: number;
  body: string;
  message: string;
  errorKind?: FetchErrorKind;
}

function mapFetchError(error: unknown): { kind: FetchErrorKind; message: string } {
  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      kind: "timeout",
      message: "Request aborted by timeout",
    };
  }
  if (error instanceof Error) {
    return {
      kind: "network_error",
      message: error.message,
    };
  }
  return {
    kind: "unknown_error",
    message: `${error}`,
  };
}

export function createFetchClient(): FetchClient {
  return {
    async fetchText(url: string, timeoutMs = 9000) {
      const detailed = await this.fetchTextDetailed(url, timeoutMs);
      if (detailed.ok || detailed.body) return detailed.body;
      throw new Error(detailed.message);
    },
    async fetchTextDetailed(url: string, timeoutMs = 9000) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.max(500, timeoutMs));

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "accept": "text/plain, text/html, application/json;q=0.9, */*;q=0.8",
            "user-agent": "ai-system-anm-rag-qis/0.1",
          },
        });
        const text = await response.text();
        if (!response.ok) {
          return {
            ok: false,
            url,
            status: response.status,
            body: text,
            errorKind: "http_error" as const,
            message: `HTTP ${response.status} on ${url}`,
          };
        }
        return {
          ok: true,
          url,
          status: response.status,
          body: text,
          message: "ok",
        };
      } catch (error) {
        const mapped = mapFetchError(error);
        return {
          ok: false,
          url,
          body: "",
          errorKind: mapped.kind,
          message: mapped.message,
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
