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

export class QueryEmbeddingClient {
  constructor(private readonly config: RagEmbeddingConfig = loadRagEmbeddingConfig()) {}

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
    logger.debug("RAG_EMBEDDING_CALL_START", {
      baseUrl: this.config.baseUrl,
      model: this.config.model,
      inputs: normalizedTexts.length,
      timeoutMs: this.config.timeoutMs,
    });

    try {
      const response = await fetch(`${this.config.baseUrl}/embeddings`, {
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
        const status = [400, 404, 422].includes(response.status) ? 422 : 502;
        throw new RagPipelineError(
          status,
          "RAG_EMBEDDING_UPSTREAM_ERROR",
          `Falha no endpoint de embeddings (${response.status})${detail ? `: ${detail}` : "."}`,
        );
      }

      const payload = (await response.json().catch(() => null)) as EmbeddingResponse | null;
      if (!payload) {
        throw new RagPipelineError(502, "RAG_EMBEDDING_INVALID_RESPONSE", "Endpoint de embeddings retornou payload invalido.");
      }

      const vectors: number[][] = [];
      for (const row of payload.data ?? []) {
        const vector = ensureFiniteNumberArray(row?.embedding);
        if (!vector) {
          throw new RagPipelineError(
            502,
            "RAG_EMBEDDING_INVALID_VECTOR",
            "Endpoint de embeddings retornou vetor ausente ou invalido.",
          );
        }
        if (vector.length !== this.config.expectedDimension) {
          throw new RagPipelineError(
            500,
            "RAG_EMBEDDING_DIMENSION_MISMATCH",
            `Dimensao do embedding divergente: recebido=${vector.length}, esperado=${this.config.expectedDimension}.`,
            {
              embeddingModel: this.config.model,
              expectedDimension: this.config.expectedDimension,
            },
          );
        }
        vectors.push(vector);
      }

      if (!vectors.length || vectors.length !== normalizedTexts.length) {
        throw new RagPipelineError(
          502,
          "RAG_EMBEDDING_SIZE_MISMATCH",
          `Quantidade de embeddings divergente: recebido=${vectors.length}, esperado=${normalizedTexts.length}.`,
        );
      }

      const firstModel = payload.data?.find((row) => typeof row?.model === "string")?.model;
      const resolvedModel = (firstModel || payload.model || this.config.model || "unknown").trim() || "unknown";
      logger.debug("RAG_EMBEDDING_CALL_DONE", {
        baseUrl: this.config.baseUrl,
        model: resolvedModel,
        inputs: normalizedTexts.length,
        dimension: vectors[0].length,
        elapsedMs: Date.now() - startedAt,
      });
      return {
        vectors,
        model: resolvedModel,
        dimension: vectors[0].length,
        elapsedMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (error instanceof RagPipelineError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        logger.error("RAG_EMBEDDING_TIMEOUT", { baseUrl: this.config.baseUrl, timeoutMs: this.config.timeoutMs });
        throw new RagPipelineError(504, "RAG_EMBEDDING_TIMEOUT", "Timeout ao gerar embeddings.");
      }
      logger.error("RAG_EMBEDDING_UNAVAILABLE", { baseUrl: this.config.baseUrl });
      throw new RagPipelineError(
        503,
        "RAG_EMBEDDING_UNAVAILABLE",
        `Endpoint de embeddings indisponivel em ${this.config.baseUrl}.`,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export function createQueryEmbeddingClient(rawEnv = process.env) {
  return new QueryEmbeddingClient(loadRagEmbeddingConfig(rawEnv));
}
