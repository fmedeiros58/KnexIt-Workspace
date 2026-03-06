import { execFileSync } from "node:child_process";
import { loadRagEmbeddingConfig, type RagEmbeddingConfig } from "./rag-config";
import { RagPipelineError } from "./rag-errors";
import { logger } from "../utils/logger";

type EmbeddingResponse = {
  model?: string;
  data?: Array<{
    embedding?: unknown;
    model?: string;
  }>;
};

export type QueryEmbeddingResult = {
  vector: number[];
  model: string;
  dimension: number;
  elapsedMs: number;
};

export type TextEmbeddingsResult = {
  vectors: number[][];
  model: string;
  dimension: number;
  elapsedMs: number;
};

function ensureFiniteNumberArray(value: unknown) {
  if (!Array.isArray(value) || !value.length) return null;
  const vector: number[] = [];
  for (const item of value) {
    if (typeof item !== "number" || !Number.isFinite(item)) return null;
    vector.push(item);
  }
  return vector;
}

function normalizeUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function safeJoinUrl(baseUrl: string, pathname: string) {
  const base = normalizeUrl(baseUrl);
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  try {
    const url = new URL(base);
    url.pathname = normalizedPath;
    url.search = "";
    url.hash = "";
    return normalizeUrl(url.toString());
  } catch {
    return `${base}${normalizedPath}`;
  }
}

const WSL_DISCOVERY_CACHE_MS = 60_000;

function isLoopbackHostname(hostname: string) {
  const normalized = (hostname || "").trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "localhost";
}

function isIpv4Address(value: string) {
  const parts = value.trim().split(".");
  if (parts.length !== 4) return false;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return false;
    const parsed = Number(part);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 255) return false;
  }
  return true;
}

function replaceHostname(baseUrl: string, host: string) {
  try {
    const parsed = new URL(baseUrl);
    parsed.hostname = host;
    return normalizeUrl(parsed.toString());
  } catch {
    return "";
  }
}

function parseBooleanFlag(value: string | undefined, fallback: boolean) {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

type EndpointAttempt = {
  baseUrl: string;
  kind:
    | "success"
    | "healthcheck_failed"
    | "timeout"
    | "unreachable"
    | "http_error"
    | "invalid_payload"
    | "dimension_mismatch";
  detail?: string;
  status?: number;
};

export class QueryEmbeddingClient {
  private readonly healthCache = new Map<string, { checkedAt: number; healthy: boolean }>();
  private readonly wslDiscoveryEnabled: boolean;
  private wslDiscoveryCache: { checkedAt: number; urls: string[] } | null = null;
  private preferredBaseUrl: string;

  constructor(private readonly config: RagEmbeddingConfig = loadRagEmbeddingConfig()) {
    this.preferredBaseUrl = normalizeUrl(config.baseUrl);
    this.wslDiscoveryEnabled = parseBooleanFlag(process.env.EMBEDDING_WSL_DISCOVERY_ENABLED, true);
  }

  getConfig() {
    return this.config;
  }

  async embedQuery(text: string): Promise<QueryEmbeddingResult> {
    const result = await this.embedTexts([text], "RAG_QUERY_EMPTY", "Pergunta vazia: informe texto para gerar embedding.");
    const vector = result.vectors[0];
    return {
      vector,
      model: result.model,
      dimension: result.dimension,
      elapsedMs: result.elapsedMs,
    };
  }

  async embedTexts(
    texts: string[],
    emptyCode = "RAG_EMBEDDING_INPUT_EMPTY",
    emptyMessage = "Entrada vazia para gerar embeddings.",
  ): Promise<TextEmbeddingsResult> {
    const normalizedTexts = texts.map((item) => item.trim()).filter(Boolean);
    if (!normalizedTexts.length) {
      throw new RagPipelineError(400, emptyCode, emptyMessage);
    }

    const startedAt = Date.now();
    const candidates = this.resolveCandidates();
    const attempts: EndpointAttempt[] = [];
    let lastStructuredError: RagPipelineError | null = null;

    logger.debug("RAG_EMBEDDING_CALL_START", {
      baseUrl: this.config.baseUrl,
      fallbacks: this.config.fallbackBaseUrls,
      model: this.config.model,
      inputs: normalizedTexts.length,
      timeoutMs: this.config.timeoutMs,
    });

    for (const baseUrl of candidates) {
      const healthy = await this.checkEndpointHealth(baseUrl);
      if (!healthy) {
        attempts.push({ baseUrl, kind: "healthcheck_failed" });
        continue;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
      try {
        const response = await fetch(`${baseUrl}/embeddings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            input: normalizedTexts,
            encoding_format: "float",
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          const detail = body.trim().slice(0, 240);
          attempts.push({ baseUrl, kind: "http_error", status: response.status, detail });
          lastStructuredError = new RagPipelineError(
            [400, 401, 403, 404, 422].includes(response.status) ? 422 : 502,
            "RAG_EMBEDDING_UPSTREAM_ERROR",
            `Falha no endpoint de embeddings (${response.status})${detail ? `: ${detail}` : "."}`,
          );
          this.healthCache.set(baseUrl, { healthy: false, checkedAt: Date.now() });
          continue;
        }

        const payload = (await response.json().catch(() => null)) as EmbeddingResponse | null;
        if (!payload) {
          attempts.push({ baseUrl, kind: "invalid_payload" });
          lastStructuredError = new RagPipelineError(
            502,
            "RAG_EMBEDDING_INVALID_RESPONSE",
            "Endpoint de embeddings retornou payload invalido.",
          );
          continue;
        }

        const vectors: number[][] = [];
        let dimensionMismatch = false;
        for (const row of payload.data ?? []) {
          const vector = ensureFiniteNumberArray(row?.embedding);
          if (!vector) {
            dimensionMismatch = true;
            lastStructuredError = new RagPipelineError(
              502,
              "RAG_EMBEDDING_INVALID_VECTOR",
              "Endpoint de embeddings retornou vetor ausente ou invalido.",
            );
            break;
          }
          if (vector.length !== this.config.expectedDimension) {
            dimensionMismatch = true;
            lastStructuredError = new RagPipelineError(
              500,
              "RAG_EMBEDDING_DIMENSION_MISMATCH",
              `Dimensao do embedding divergente: recebido=${vector.length}, esperado=${this.config.expectedDimension}.`,
              {
                embeddingModel: this.config.model,
                expectedDimension: this.config.expectedDimension,
              },
            );
            break;
          }
          vectors.push(vector);
        }

        if (dimensionMismatch) {
          attempts.push({ baseUrl, kind: "dimension_mismatch" });
          continue;
        }

        if (!vectors.length || vectors.length !== normalizedTexts.length) {
          attempts.push({ baseUrl, kind: "invalid_payload", detail: "size_mismatch" });
          lastStructuredError = new RagPipelineError(
            502,
            "RAG_EMBEDDING_SIZE_MISMATCH",
            `Quantidade de embeddings divergente: recebido=${vectors.length}, esperado=${normalizedTexts.length}.`,
          );
          continue;
        }

        const firstModel = payload.data?.find((row) => typeof row?.model === "string")?.model;
        const resolvedModel = (firstModel || payload.model || this.config.model || "unknown").trim() || "unknown";
        this.preferredBaseUrl = baseUrl;
        this.healthCache.set(baseUrl, { healthy: true, checkedAt: Date.now() });
        attempts.push({ baseUrl, kind: "success" });
        logger.debug("RAG_EMBEDDING_CALL_DONE", {
          baseUrl,
          model: resolvedModel,
          inputs: normalizedTexts.length,
          dimension: vectors[0].length,
          elapsedMs: Date.now() - startedAt,
          attempts,
        });
        return {
          vectors,
          model: resolvedModel,
          dimension: vectors[0].length,
          elapsedMs: Date.now() - startedAt,
        };
      } catch (error) {
        if (isAbortError(error)) {
          attempts.push({ baseUrl, kind: "timeout" });
          lastStructuredError = new RagPipelineError(504, "RAG_EMBEDDING_TIMEOUT", "Timeout ao gerar embeddings.");
          this.healthCache.set(baseUrl, { healthy: false, checkedAt: Date.now() });
          continue;
        }
        attempts.push({ baseUrl, kind: "unreachable", detail: error instanceof Error ? error.message : String(error) });
        this.healthCache.set(baseUrl, { healthy: false, checkedAt: Date.now() });
        continue;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (lastStructuredError) {
      logger.error("RAG_EMBEDDING_ALL_ENDPOINTS_FAILED", {
        primaryBaseUrl: this.config.baseUrl,
        attempts,
        code: lastStructuredError.code,
        status: lastStructuredError.status,
      });
      throw new RagPipelineError(
        lastStructuredError.status,
        lastStructuredError.code,
        `${lastStructuredError.message} Endpoints tentados: ${candidates.join(", ")}.`,
        { attempts },
      );
    }

    logger.error("RAG_EMBEDDING_UNAVAILABLE", { primaryBaseUrl: this.config.baseUrl, attempts });
    throw new RagPipelineError(
      503,
      "RAG_EMBEDDING_UNAVAILABLE",
      `Endpoint de embeddings indisponivel. Endpoints tentados: ${candidates.join(", ")}.`,
      {
        attempts,
        suggestion: "Suba o servico com `npm run serve:embeddings:cpu` e confirme /health.",
      },
    );
  }

  private resolveCandidates() {
    const dynamicFallbacks = this.resolveDynamicFallbacks();
    const ordered = [
      normalizeUrl(this.preferredBaseUrl),
      normalizeUrl(this.config.baseUrl),
      ...this.config.fallbackBaseUrls.map((item) => normalizeUrl(item)),
      ...dynamicFallbacks,
    ];
    const result: string[] = [];
    const seen = new Set<string>();
    for (const url of ordered) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      result.push(url);
    }
    return result;
  }

  private resolveDynamicFallbacks() {
    if (!this.wslDiscoveryEnabled) return [];
    if (process.platform !== "win32") return [];

    const seedUrls = [normalizeUrl(this.preferredBaseUrl), normalizeUrl(this.config.baseUrl), ...this.config.fallbackBaseUrls];
    const loopbackSeeds = seedUrls.filter((baseUrl) => {
      try {
        return isLoopbackHostname(new URL(baseUrl).hostname);
      } catch {
        return false;
      }
    });
    if (!loopbackSeeds.length) return [];

    const now = Date.now();
    if (this.wslDiscoveryCache && now - this.wslDiscoveryCache.checkedAt < WSL_DISCOVERY_CACHE_MS) {
      return this.wslDiscoveryCache.urls;
    }

    const rawConfiguredWslHost = (process.env.EMBEDDING_WSL_HOST_IP || "").trim();
    const discoveredHosts: string[] = [];
    if (isIpv4Address(rawConfiguredWslHost)) {
      discoveredHosts.push(rawConfiguredWslHost);
    } else {
      const discoveredViaWsl = this.tryDiscoverWslHostIp();
      if (discoveredViaWsl && isIpv4Address(discoveredViaWsl)) {
        discoveredHosts.push(discoveredViaWsl);
      }
    }

    const dynamicUrls = Array.from(
      new Set(
        discoveredHosts.flatMap((host) =>
          loopbackSeeds
            .map((baseUrl) => replaceHostname(baseUrl, host))
            .filter(Boolean),
        ),
      ),
    );
    this.wslDiscoveryCache = { checkedAt: now, urls: dynamicUrls };
    if (dynamicUrls.length > 0) {
      logger.debug("RAG_EMBEDDING_DYNAMIC_FALLBACKS", {
        discoveredHosts,
        dynamicUrls,
      });
    }
    return dynamicUrls;
  }

  private tryDiscoverWslHostIp() {
    try {
      const output = execFileSync(
        "wsl.exe",
        ["-e", "bash", "-lc", "hostname -I 2>/dev/null | awk '{print $1}'"],
        {
          encoding: "utf8",
          timeout: 1200,
          stdio: ["ignore", "pipe", "ignore"],
        },
      );
      return `${output || ""}`.trim();
    } catch {
      return "";
    }
  }

  private async checkEndpointHealth(baseUrl: string) {
    const now = Date.now();
    const cached = this.healthCache.get(baseUrl);
    if (cached && now - cached.checkedAt < this.config.healthcheckCacheMs) {
      return cached.healthy;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.min(5000, this.config.timeoutMs));
    const healthUrl = safeJoinUrl(baseUrl, this.config.healthcheckPath);
    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        signal: controller.signal,
      });
      const healthy = response.ok;
      this.healthCache.set(baseUrl, { healthy, checkedAt: now });
      return healthy;
    } catch {
      this.healthCache.set(baseUrl, { healthy: false, checkedAt: now });
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export function createQueryEmbeddingClient(rawEnv = process.env) {
  return new QueryEmbeddingClient(loadRagEmbeddingConfig(rawEnv));
}
