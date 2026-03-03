import { loadRagLlmConfig, type RagLlmConfig } from "./rag-config";
import { RagPipelineError } from "./rag-errors";
import { logger } from "../utils/logger";

export type RagChatHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

export type RagLlmRequest = {
  question: string;
  contextPack: string;
  history: RagChatHistoryItem[];
  maxTokens: number;
  temperature: number;
  seed: number | null;
};

export type RagLlmResult = {
  answer: string;
  model: string;
  finishReason: string | null;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
  elapsedMs: number;
};

type ChatCompletionPayload = {
  id?: string;
  model?: string;
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | null;
    } | null;
    text?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

function isInternalBaseUrl(baseUrl: string) {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(baseUrl);
}

function toTokenNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function buildSystemPrompt() {
  return [
    "Voce e um assistente de RAG interno da plataforma KnexIT.",
    "Use exclusivamente o CONTEXTO recuperado para responder.",
    "Se o contexto nao contiver informacao suficiente, diga explicitamente que nao encontrou base suficiente.",
    "Nao invente fontes, IDs, fatos ou valores.",
    "Mantenha a resposta objetiva e auditavel.",
  ].join(" ");
}

function buildUserPrompt(question: string, contextPack: string) {
  const normalizedContext = contextPack.trim();
  const contextBlock = normalizedContext || "[sem contexto recuperado]";
  return [
    "INSTRUCOES DE RESPOSTA:",
    buildSystemPrompt(),
    "",
    "CONTEXTO RECUPERADO:",
    contextBlock,
    "",
    "PERGUNTA:",
    question.trim(),
    "",
    "Responda usando apenas o contexto acima.",
  ].join("\n");
}

function normalizeHistoryForVllm(history: RagChatHistoryItem[]) {
  const normalized: RagChatHistoryItem[] = [];
  for (const row of history) {
    if (!row || (row.role !== "user" && row.role !== "assistant")) continue;
    const content = `${row.content || ""}`.trim();
    if (!content) continue;
    if (!normalized.length && row.role === "assistant") continue;
    const previous = normalized[normalized.length - 1];
    if (previous && previous.role === row.role) {
      normalized[normalized.length - 1] = { role: row.role, content };
      continue;
    }
    normalized.push({ role: row.role, content });
  }
  while (normalized.length > 0 && normalized[normalized.length - 1].role === "user") {
    normalized.pop();
  }
  return normalized;
}

export class VllmInternalClient {
  constructor(private readonly config: RagLlmConfig = loadRagLlmConfig()) {}

  getConfig() {
    return this.config;
  }

  async completeWithContext(input: RagLlmRequest): Promise<RagLlmResult> {
    if (this.config.requireInternalBaseUrl && !isInternalBaseUrl(this.config.baseUrl)) {
      throw new RagPipelineError(
        500,
        "RAG_LLM_BASE_URL_NOT_INTERNAL",
        "RAG_LLM_BASE_URL deve apontar para endpoint interno (localhost/127.0.0.1).",
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const startedAt = Date.now();
    logger.info("RAG_LLM_CALL_START", {
      baseUrl: this.config.baseUrl,
      model: this.config.model,
      timeoutMs: this.config.timeoutMs,
      maxTokens: input.maxTokens,
      temperature: input.temperature,
      contextChars: input.contextPack.length,
      historyItems: input.history.length,
    });

    try {
      const normalizedHistory = normalizeHistoryForVllm(input.history);
      const messages = [
        ...normalizedHistory.map((item) => ({ role: item.role, content: item.content })),
        { role: "user", content: buildUserPrompt(input.question, input.contextPack) },
      ];

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: input.temperature,
          max_tokens: input.maxTokens,
          stream: false,
          seed: input.seed ?? undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const detail = body.trim().slice(0, 240);
        throw new RagPipelineError(
          [400, 404, 422].includes(response.status) ? 422 : 502,
          "RAG_LLM_UPSTREAM_ERROR",
          `Falha ao consultar vLLM (${response.status})${detail ? `: ${detail}` : "."}`,
        );
      }

      const payload = (await response.json().catch(() => null)) as ChatCompletionPayload | null;
      if (!payload) {
        throw new RagPipelineError(502, "RAG_LLM_INVALID_RESPONSE", "vLLM retornou payload invalido.");
      }

      const firstChoice = payload.choices?.[0];
      const answerRaw = firstChoice?.message?.content ?? firstChoice?.text ?? "";
      const answer = `${answerRaw || ""}`.trim();
      if (!answer) {
        throw new RagPipelineError(502, "RAG_LLM_EMPTY_ANSWER", "vLLM retornou resposta vazia.");
      }

      logger.info("RAG_LLM_CALL_DONE", {
        baseUrl: this.config.baseUrl,
        model: payload.model || this.config.model,
        elapsedMs: Date.now() - startedAt,
        finishReason: firstChoice?.finish_reason ?? null,
      });
      return {
        answer,
        model: `${payload.model || this.config.model}`.trim() || this.config.model,
        finishReason: firstChoice?.finish_reason ?? null,
        usage: {
          promptTokens: toTokenNumber(payload.usage?.prompt_tokens),
          completionTokens: toTokenNumber(payload.usage?.completion_tokens),
          totalTokens: toTokenNumber(payload.usage?.total_tokens),
        },
        elapsedMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (error instanceof RagPipelineError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        logger.error("RAG_LLM_TIMEOUT", { baseUrl: this.config.baseUrl, timeoutMs: this.config.timeoutMs });
        throw new RagPipelineError(504, "RAG_LLM_TIMEOUT", "Timeout ao consultar o vLLM interno.");
      }
      logger.error("RAG_LLM_UNAVAILABLE", { baseUrl: this.config.baseUrl });
      throw new RagPipelineError(503, "RAG_LLM_UNAVAILABLE", `vLLM indisponivel em ${this.config.baseUrl}.`);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export function createVllmInternalClient(rawEnv = process.env) {
  return new VllmInternalClient(loadRagLlmConfig(rawEnv));
}
