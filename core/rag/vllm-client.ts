import { execFileSync } from "node:child_process";
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

const WSL_DISCOVERY_CACHE_MS = 60_000;
const MODEL_DISCOVERY_CACHE_MS = 60_000;
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504, 524]);

type LlmEndpointAttempt = {
  baseUrl: string;
  kind:
    | "success"
    | "healthcheck_failed"
    | "timeout"
    | "unreachable"
    | "http_error"
    | "invalid_payload"
    | "empty_answer";
  detail?: string;
  status?: number;
};

function isInternalBaseUrl(baseUrl: string) {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(baseUrl);
}

function normalizeUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function parseBooleanFlag(value: string | undefined, fallback: boolean) {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
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

function sleepMs(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function toTokenNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function extractAnswerTextFromPayload(payload: ChatCompletionPayload | null) {
  const firstChoice = payload?.choices?.[0];
  const answerRaw = firstChoice?.message?.content ?? firstChoice?.text ?? "";
  return `${answerRaw || ""}`.trim();
}

function extractDeltaTextFromStreamPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const parsed = payload as {
    choices?: Array<{
      delta?: { content?: unknown };
      text?: unknown;
      message?: { content?: unknown } | null;
    }>;
  };
  const firstChoice = parsed.choices?.[0];
  if (!firstChoice) return "";
  const deltaContent = firstChoice.delta?.content;
  if (typeof deltaContent === "string") return deltaContent;
  if (Array.isArray(deltaContent)) {
    return deltaContent
      .map((row) => {
        if (typeof row === "string") return row;
        if (row && typeof row === "object" && typeof (row as { text?: unknown }).text === "string") {
          return (row as { text?: string }).text || "";
        }
        return "";
      })
      .join("");
  }
  if (typeof firstChoice.text === "string") return firstChoice.text;
  if (firstChoice.message && typeof firstChoice.message.content === "string") return firstChoice.message.content;
  return "";
}

function shouldRetryWithLowerTokens(status: number, body: string) {
  if (![400, 413, 422].includes(status)) return false;
  const normalized = (body || "").toLowerCase();
  return /(max.?tokens|max_model_len|context|too long|exceed|token)/i.test(normalized);
}

function isMissingModelError(status: number, body: string) {
  if (status !== 404) return false;
  const normalized = (body || "").toLowerCase();
  return /(model|not.?found|does not exist|unknown model|notfounderror)/i.test(normalized);
}

function buildTokenCandidates(requestedMaxTokens: number) {
  const rawCandidates = [
    requestedMaxTokens,
    Math.floor(requestedMaxTokens * 0.85),
    Math.floor(requestedMaxTokens * 0.7),
    Math.floor(requestedMaxTokens * 0.55),
    Math.floor(requestedMaxTokens * 0.4),
    3072,
    2048,
    1536,
    1024,
    768,
    512,
    384,
    256,
  ];
  const normalized = rawCandidates
    .map((value) => Math.max(64, Math.min(65_536, Math.trunc(value))))
    .filter((value) => Number.isFinite(value));

  const uniqueOrdered: number[] = [];
  for (const value of normalized) {
    if (!uniqueOrdered.includes(value)) uniqueOrdered.push(value);
  }
  return uniqueOrdered;
}

type PromptDepthPolicy = "brief" | "standard" | "deep";

type PromptInstructionProfile = {
  hasRetrievedContext: boolean;
  strictContextOnly: boolean;
  strictContextRelaxed: boolean;
  requiresVerifiableContext: boolean;
  depthPolicy: PromptDepthPolicy;
};

function countWords(text: string) {
  return text
    .trim()
    .split(/\s+/g)
    .filter(Boolean).length;
}

function requiresVerifiableContext(question: string) {
  const normalized = `${question || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  return /\b(dado|dados|numero|numeros|percentual|taxa|estatistica|fonte|citacao|referencia|artigo|lei|norma|resolucao|data|ano|preco|valor|dosagem|dose|mg|ml)\b/i.test(
    normalized,
  );
}

function inferDepthPolicy(question: string): PromptDepthPolicy {
  const normalized = `${question || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  const wordCount = countWords(question);
  const asksBrief = /\b(resuma|resumo|curto|curta|breve|objetivo|objetiva|em 1 frase|uma frase)\b/i.test(normalized);
  if (asksBrief && wordCount <= 18) return "brief";

  const deepSignals =
    /\b(explique|detalhe|aprofunde|analise|compare|impacto|consequenc|riscos?|causas?|efeitos?|passo a passo|trade[- ]?off|estrategia)\b/i.test(
      normalized,
    ) || wordCount >= 24;
  if (deepSignals) return "deep";

  return "standard";
}

function buildPromptInstructionProfile(
  question: string,
  contextPack: string,
  strictContextOnly: boolean,
): PromptInstructionProfile {
  const hasRetrievedContext = contextPack.trim().length > 0;
  const verifiable = requiresVerifiableContext(question);
  const strictContextRelaxed = strictContextOnly && !hasRetrievedContext && !verifiable;
  const effectiveStrict = strictContextOnly && !strictContextRelaxed;
  return {
    hasRetrievedContext,
    strictContextOnly: effectiveStrict,
    strictContextRelaxed,
    requiresVerifiableContext: verifiable,
    depthPolicy: inferDepthPolicy(question),
  };
}

function buildSystemPrompt(profile: PromptInstructionProfile) {
  const lines: string[] = [
    "Voce e um assistente de RAG interno da plataforma KnexIT.",
    "Responda sempre no mesmo idioma predominante da PERGUNTA do usuario, salvo pedido explicito de traducao.",
    "Nao invente fontes, IDs, fatos ou valores.",
  ];

  if (profile.strictContextOnly) {
    lines.push("Use exclusivamente o CONTEXTO recuperado para responder.");
    lines.push("Se o contexto nao contiver informacao suficiente, declare isso de forma objetiva e curta.");
  } else {
    if (profile.strictContextRelaxed) {
      lines.push("Modo estrito foi relaxado por ausencia de contexto recuperado em pergunta geral.");
    }
    lines.push("Priorize o CONTEXTO recuperado como fonte principal da resposta.");
    lines.push(
      "Se o contexto vier incompleto e a pergunta for geral/conceitual, complemente com conhecimento geral confiavel do modelo.",
    );
    if (profile.requiresVerifiableContext) {
      lines.push(
        "Quando houver pedido de dado verificavel (numero, data, lei, dosagem, fonte), sinalize brevemente a limitacao se o contexto nao trouxer base.",
      );
    } else {
      lines.push("Evite responder apenas com 'sem base suficiente' em perguntas genericas.");
    }
  }

  if (profile.depthPolicy === "brief") {
    lines.push("Para perguntas simples, responda em 1 paragrafo curto (3 a 5 frases).");
  } else if (profile.depthPolicy === "standard") {
    lines.push("Para perguntas explicativas, responda em 2 a 4 paragrafos objetivos.");
  } else {
    lines.push(
      "Para perguntas complexas, responda em 4 a 7 paragrafos coesos cobrindo mecanismos, implicacoes, limites e sintese final.",
    );
  }

  lines.push("Mantenha progressao logica e evite repeticao desnecessaria.");
  lines.push("Mantenha a resposta auditavel.");
  return lines.join(" ");
}

function inferResponseLanguage(question: string) {
  const raw = `${question || ""}`.trim();
  if (!raw) return "mesmo idioma da pergunta";
  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (/[áàâãéêíóôõúç]/i.test(raw)) return "portugues brasileiro";

  const words = normalized.split(/[^a-z0-9]+/g).filter(Boolean);
  const ptHints = new Set([
    "o",
    "a",
    "os",
    "as",
    "de",
    "do",
    "da",
    "dos",
    "das",
    "um",
    "uma",
    "para",
    "com",
    "sem",
    "que",
    "como",
    "qual",
    "quais",
    "responda",
    "explique",
  ]);
  const enHints = new Set(["the", "and", "what", "which", "explain", "summarize", "answer", "about", "with"]);
  let ptScore = 0;
  let enScore = 0;
  for (const word of words) {
    if (ptHints.has(word)) ptScore += 1;
    if (enHints.has(word)) enScore += 1;
  }

  if (ptScore > enScore) return "portugues brasileiro";
  if (enScore > ptScore) return "ingles";
  return "mesmo idioma da pergunta";
}

function buildUserPrompt(question: string, contextPack: string, profile: PromptInstructionProfile) {
  const normalizedContext = contextPack.trim();
  const contextBlock = normalizedContext || "[sem contexto recuperado]";
  const requiredLanguage = inferResponseLanguage(question);
  const finalDirective = profile.strictContextOnly
    ? "Responda usando apenas o contexto acima e no idioma obrigatorio definido."
    : profile.hasRetrievedContext
      ? "Responda priorizando o contexto acima; complemente com conhecimento geral apenas se faltar detalhe."
      : profile.requiresVerifiableContext
        ? "Sem contexto recuperado relevante. Responda apenas o que for seguro e indique limitacao breve para dados verificaveis."
        : "Sem contexto recuperado relevante. Responda com conhecimento geral confiavel e profundidade proporcional.";
  const depthDirective =
    profile.depthPolicy === "deep"
      ? "Tamanho alvo: no minimo 5 paragrafos curtos e bem conectados."
      : profile.depthPolicy === "standard"
        ? "Tamanho alvo: 2 a 4 paragrafos objetivos."
        : "Tamanho alvo: 1 paragrafo curto.";
  return [
    "INSTRUCOES DE RESPOSTA:",
    buildSystemPrompt(profile),
    `IDIOMA OBRIGATORIO DA RESPOSTA: ${requiredLanguage}. Nao mude de idioma sem pedido explicito.`,
    "",
    "CONTEXTO RECUPERADO:",
    contextBlock,
    "",
    "PERGUNTA:",
    question.trim(),
    "",
    finalDirective,
    depthDirective,
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
  private readonly healthCache = new Map<string, { checkedAt: number; healthy: boolean }>();
  private readonly modelCache = new Map<string, { checkedAt: number; model: string }>();
  private readonly wslDiscoveryEnabled: boolean;
  private wslDiscoveryCache: { checkedAt: number; urls: string[] } | null = null;
  private preferredBaseUrl: string;

  constructor(private readonly config: RagLlmConfig = loadRagLlmConfig()) {
    this.preferredBaseUrl = normalizeUrl(config.baseUrl);
    this.wslDiscoveryEnabled = parseBooleanFlag(process.env.RAG_LLM_WSL_DISCOVERY_ENABLED, true);
  }

  getConfig() {
    return this.config;
  }

  private resolveCandidates() {
    const dynamicFallbacks = this.resolveDynamicFallbacks();
    const ordered = [
      normalizeUrl(this.preferredBaseUrl),
      normalizeUrl(this.config.baseUrl),
      ...this.config.fallbackBaseUrls.map((item) => normalizeUrl(item)),
      ...dynamicFallbacks,
    ];
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const item of ordered) {
      if (!item || seen.has(item)) continue;
      seen.add(item);
      unique.push(item);
    }
    return unique;
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

    const discoveredHosts: string[] = [];
    const configuredHost = (process.env.RAG_LLM_WSL_HOST_IP || "").trim();
    if (isIpv4Address(configuredHost)) {
      discoveredHosts.push(configuredHost);
    } else {
      const discovered = this.tryDiscoverWslHostIp();
      if (discovered && isIpv4Address(discovered)) {
        discoveredHosts.push(discovered);
      }
    }

    const urls = Array.from(
      new Set(
        discoveredHosts.flatMap((host) =>
          loopbackSeeds
            .map((baseUrl) => replaceHostname(baseUrl, host))
            .filter(Boolean),
        ),
      ),
    );
    this.wslDiscoveryCache = { checkedAt: now, urls };
    if (urls.length > 0) {
      logger.debug("RAG_LLM_DYNAMIC_FALLBACKS", {
        discoveredHosts,
        dynamicUrls: urls,
      });
    }
    return urls;
  }

  private tryDiscoverWslHostIp() {
    try {
      const output = execFileSync(
        "wsl.exe",
        ["-e", "bash", "-lc", "hostname -I 2>/dev/null | awk '{print $1}'"],
        {
          encoding: "utf8",
          timeout: 1_200,
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
    const timeoutId = setTimeout(() => controller.abort(), Math.min(5_000, this.config.timeoutMs));
    const healthUrl = safeJoinUrl(baseUrl, this.config.healthcheckPath);
    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
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

  private async resolveModelForEndpoint(baseUrl: string, forceRefresh = false) {
    const now = Date.now();
    const cached = this.modelCache.get(baseUrl);
    if (!forceRefresh && cached && now - cached.checkedAt < MODEL_DISCOVERY_CACHE_MS) {
      return cached.model;
    }

    const configuredModel = `${this.config.model || ""}`.trim();
    const fallbackModel = configuredModel || "mistral-awq";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.min(6_000, this.config.timeoutMs));
    try {
      const response = await fetch(`${baseUrl}/models`, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        signal: controller.signal,
      });
      if (!response.ok) {
        this.modelCache.set(baseUrl, { checkedAt: now, model: fallbackModel });
        return fallbackModel;
      }

      const payload = (await response.json().catch(() => null)) as { data?: Array<{ id?: unknown }> } | null;
      const modelIds =
        payload?.data
          ?.map((row) => (typeof row?.id === "string" ? row.id.trim() : ""))
          .filter((value) => value.length > 0) ?? [];

      if (!modelIds.length) {
        this.modelCache.set(baseUrl, { checkedAt: now, model: fallbackModel });
        return fallbackModel;
      }

      const model = modelIds.includes(configuredModel) ? configuredModel : modelIds[0];
      this.modelCache.set(baseUrl, { checkedAt: now, model });
      if (model !== configuredModel) {
        logger.warn("RAG_LLM_MODEL_AUTODETECTED", {
          baseUrl,
          configuredModel: configuredModel || null,
          selectedModel: model,
          availableModels: modelIds,
        });
      }
      return model;
    } catch {
      this.modelCache.set(baseUrl, { checkedAt: now, model: fallbackModel });
      return fallbackModel;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private resolveRetryBackoff(attempt: number) {
    const base = Math.max(25, this.config.retryBackoffMs);
    const exponential = Math.min(5_000, base * Math.pow(2, Math.max(0, attempt)));
    const jitter = Math.round(exponential * 0.15 * Math.random());
    return exponential + jitter;
  }

  private buildUnavailableSuggestion() {
    if (process.platform === "win32") {
      return "Suba/reinicie o vLLM com `npm run serve:vllm:wsl` (ou `npm run serve:vllm:wsl:restart`) e confirme /v1/models.";
    }
    return "Suba/reinicie o vLLM e confirme o endpoint /v1/models.";
  }

  private async requestCompletionWithRetry(
    baseUrl: string,
    body: Record<string, unknown>,
    stream: boolean,
    requestLabel: "complete" | "stream",
  ): Promise<Response> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < this.config.retryAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (RETRYABLE_HTTP_STATUSES.has(response.status) && attempt < this.config.retryAttempts - 1) {
          logger.warn("RAG_LLM_HTTP_RETRY", {
            baseUrl,
            status: response.status,
            requestLabel,
            stream,
            attempt: attempt + 1,
            maxAttempts: this.config.retryAttempts,
          });
          await response.text().catch(() => "");
          await sleepMs(this.resolveRetryBackoff(attempt));
          continue;
        }

        return response;
      } catch (error) {
        lastError = error;
        if (isAbortError(error)) {
          if (attempt < this.config.retryAttempts - 1) {
            logger.warn("RAG_LLM_TIMEOUT_RETRY", {
              baseUrl,
              timeoutMs: this.config.timeoutMs,
              requestLabel,
              stream,
              attempt: attempt + 1,
              maxAttempts: this.config.retryAttempts,
            });
            await sleepMs(this.resolveRetryBackoff(attempt));
            continue;
          }
          throw new RagPipelineError(504, "RAG_LLM_TIMEOUT", "Timeout ao consultar o vLLM interno.");
        }

        if (attempt < this.config.retryAttempts - 1) {
          logger.warn("RAG_LLM_CONNECTIVITY_RETRY", {
            baseUrl,
            requestLabel,
            stream,
            attempt: attempt + 1,
            maxAttempts: this.config.retryAttempts,
            detail: error instanceof Error ? error.message : String(error),
          });
          await sleepMs(this.resolveRetryBackoff(attempt));
          continue;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    const detail = lastError instanceof Error ? lastError.message : "falha de conectividade";
    throw new RagPipelineError(503, "RAG_LLM_UNAVAILABLE", `Falha de conexao com vLLM: ${detail}.`);
  }

  private toPlainTextStream(
    upstream: Response,
    options: {
      baseUrl: string;
      touchTimeout: () => void;
      clearTimeout: () => void;
      startedAt: number;
      requestedMaxTokens: number;
      usedMaxTokens: number;
    },
  ) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const contentType = (upstream.headers.get("content-type") || "").toLowerCase();

    return new ReadableStream<Uint8Array>({
      start: async (controller) => {
        let emittedChars = 0;
        let doneLogged = false;
        const finalizeLog = (finishReason: string | null) => {
          if (doneLogged) return;
          doneLogged = true;
          logger.info("RAG_LLM_STREAM_DONE", {
            baseUrl: options.baseUrl,
            model: this.config.model,
            elapsedMs: Date.now() - options.startedAt,
            emittedChars,
            requestedMaxTokens: options.requestedMaxTokens,
            usedMaxTokens: options.usedMaxTokens,
            finishReason,
          });
        };

        try {
          options.touchTimeout();
          if (contentType.includes("text/event-stream")) {
            if (!upstream.body) {
              throw new RagPipelineError(502, "RAG_LLM_INVALID_RESPONSE", "vLLM retornou stream vazio.");
            }
            const reader = upstream.body.getReader();
            let buffer = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              options.touchTimeout();
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split(/\r?\n/);
              buffer = lines.pop() || "";

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith("data:")) continue;
                const data = trimmed.slice(5).trim();
                if (!data) continue;
                if (data === "[DONE]") {
                  finalizeLog("stop");
                  controller.close();
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  const delta = extractDeltaTextFromStreamPayload(parsed);
                  if (!delta) continue;
                  emittedChars += delta.length;
                  controller.enqueue(encoder.encode(delta));
                } catch {
                  continue;
                }
              }
            }

            const tail = decoder.decode();
            if (tail) {
              emittedChars += tail.length;
              controller.enqueue(encoder.encode(tail));
            }
            finalizeLog("stop");
            controller.close();
            return;
          }

          options.touchTimeout();
          const payload = (await upstream.json().catch(() => null)) as ChatCompletionPayload | null;
          const answer = extractAnswerTextFromPayload(payload);
          if (!answer) {
            throw new RagPipelineError(502, "RAG_LLM_EMPTY_ANSWER", "vLLM retornou resposta vazia.");
          }
          emittedChars = answer.length;
          controller.enqueue(encoder.encode(answer));
          finalizeLog(payload?.choices?.[0]?.finish_reason ?? null);
          controller.close();
        } catch (error) {
          if (error instanceof RagPipelineError) {
            controller.error(error);
            return;
          }
          if (error instanceof DOMException && error.name === "AbortError") {
            logger.error("RAG_LLM_TIMEOUT", {
              baseUrl: options.baseUrl,
              timeoutMs: this.config.timeoutMs,
              requestedMaxTokens: options.requestedMaxTokens,
              usedMaxTokens: options.usedMaxTokens,
            });
            controller.error(new RagPipelineError(504, "RAG_LLM_TIMEOUT", "Timeout durante stream do vLLM interno."));
            return;
          }
          controller.error(new RagPipelineError(503, "RAG_LLM_UNAVAILABLE", "Falha ao streamar resposta do vLLM."));
        } finally {
          options.clearTimeout();
        }
      },
    });
  }

  async completeWithContext(input: RagLlmRequest): Promise<RagLlmResult> {
    if (this.config.requireInternalBaseUrl && !isInternalBaseUrl(this.config.baseUrl)) {
      throw new RagPipelineError(
        500,
        "RAG_LLM_BASE_URL_NOT_INTERNAL",
        "RAG_LLM_BASE_URL deve apontar para endpoint interno (localhost/127.0.0.1).",
      );
    }

    const startedAt = Date.now();
    const candidates = this.resolveCandidates();
    const attempts: LlmEndpointAttempt[] = [];
    const promptProfile = buildPromptInstructionProfile(input.question, input.contextPack, this.config.strictContextOnly);
    logger.info("RAG_LLM_CALL_START", {
      baseUrl: this.config.baseUrl,
      fallbacks: this.config.fallbackBaseUrls,
      model: this.config.model,
      timeoutMs: this.config.timeoutMs,
      maxTokens: input.maxTokens,
      temperature: input.temperature,
      contextChars: input.contextPack.length,
      historyItems: input.history.length,
      retryAttempts: this.config.retryAttempts,
      strictContextOnly: promptProfile.strictContextOnly,
      hasRetrievedContext: promptProfile.hasRetrievedContext,
      requiresVerifiableContext: promptProfile.requiresVerifiableContext,
      depthPolicy: promptProfile.depthPolicy,
    });

    const normalizedHistory = normalizeHistoryForVllm(input.history);
    const messages = [
      ...normalizedHistory.map((item) => ({ role: item.role, content: item.content })),
      { role: "user", content: buildUserPrompt(input.question, input.contextPack, promptProfile) },
    ];
    const tokenCandidates = buildTokenCandidates(input.maxTokens);

    let lastStructuredError: RagPipelineError | null = null;
    let contextLimitReached = false;

    for (const baseUrl of candidates) {
      const healthy = await this.checkEndpointHealth(baseUrl);
      if (!healthy) {
        attempts.push({ baseUrl, kind: "healthcheck_failed" });
        continue;
      }

      let endpointModel = await this.resolveModelForEndpoint(baseUrl);
      let retriedModelDetection = false;
      let movedToNextEndpoint = false;
      for (let attempt = 0; attempt < tokenCandidates.length; attempt += 1) {
        const maxTokens = tokenCandidates[attempt];
        const isLastAttempt = attempt === tokenCandidates.length - 1;

        let response: Response;
        try {
          response = await this.requestCompletionWithRetry(
            baseUrl,
            {
              model: endpointModel,
              messages,
              temperature: input.temperature,
              max_tokens: maxTokens,
              stream: false,
              seed: input.seed ?? undefined,
            },
            false,
            "complete",
          );
        } catch (error) {
          if (error instanceof RagPipelineError && error.code === "RAG_LLM_TIMEOUT") {
            attempts.push({ baseUrl, kind: "timeout" });
            lastStructuredError = error;
          } else {
            const detail = error instanceof Error ? error.message : String(error);
            attempts.push({ baseUrl, kind: "unreachable", detail });
            lastStructuredError =
              error instanceof RagPipelineError
                ? error
                : new RagPipelineError(503, "RAG_LLM_UNAVAILABLE", `Falha de conexao com vLLM: ${detail}.`);
          }
          this.healthCache.set(baseUrl, { healthy: false, checkedAt: Date.now() });
          movedToNextEndpoint = true;
          break;
        }

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          const detail = body.trim().slice(0, 240);
          const status = response.status;

          if (isMissingModelError(status, body) && !retriedModelDetection) {
            const refreshedModel = await this.resolveModelForEndpoint(baseUrl, true);
            if (refreshedModel && refreshedModel !== endpointModel) {
              logger.warn("RAG_LLM_MODEL_RETRY", {
                baseUrl,
                previousModel: endpointModel,
                refreshedModel,
                status,
              });
              endpointModel = refreshedModel;
              retriedModelDetection = true;
              attempt -= 1;
              continue;
            }
          }

          if (shouldRetryWithLowerTokens(status, body)) {
            if (!isLastAttempt) {
              logger.warn("RAG_LLM_TOKEN_RETRY", {
                baseUrl,
                model: endpointModel,
                status,
                requestedMaxTokens: input.maxTokens,
                attemptMaxTokens: maxTokens,
                nextMaxTokens: tokenCandidates[attempt + 1],
              });
              continue;
            }
            contextLimitReached = true;
          }

          attempts.push({ baseUrl, kind: "http_error", status, detail });
          const structured = new RagPipelineError(
            [400, 401, 403, 404, 422].includes(status) ? 422 : 502,
            "RAG_LLM_UPSTREAM_ERROR",
            `Falha ao consultar vLLM (${status})${detail ? `: ${detail}` : "."}`,
          );
          lastStructuredError = structured;
          if (RETRYABLE_HTTP_STATUSES.has(status)) {
            this.healthCache.set(baseUrl, { healthy: false, checkedAt: Date.now() });
          }
          movedToNextEndpoint = true;
          break;
        }

        const payload = (await response.json().catch(() => null)) as ChatCompletionPayload | null;
        if (!payload) {
          attempts.push({ baseUrl, kind: "invalid_payload" });
          lastStructuredError = new RagPipelineError(502, "RAG_LLM_INVALID_RESPONSE", "vLLM retornou payload invalido.");
          movedToNextEndpoint = true;
          break;
        }

        const firstChoice = payload.choices?.[0];
        const answer = extractAnswerTextFromPayload(payload);
        if (!answer) {
          attempts.push({ baseUrl, kind: "empty_answer" });
          lastStructuredError = new RagPipelineError(502, "RAG_LLM_EMPTY_ANSWER", "vLLM retornou resposta vazia.");
          movedToNextEndpoint = true;
          break;
        }

        this.preferredBaseUrl = baseUrl;
        this.healthCache.set(baseUrl, { healthy: true, checkedAt: Date.now() });
        attempts.push({ baseUrl, kind: "success" });
        logger.info("RAG_LLM_CALL_DONE", {
          baseUrl,
          model: payload.model || this.config.model,
          elapsedMs: Date.now() - startedAt,
          finishReason: firstChoice?.finish_reason ?? null,
          requestedMaxTokens: input.maxTokens,
          usedMaxTokens: maxTokens,
          attempts,
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
      }

      if (movedToNextEndpoint) continue;
      contextLimitReached = true;
    }

    if (contextLimitReached) {
      throw new RagPipelineError(
        422,
        "RAG_LLM_CONTEXT_LIMIT",
        "Contexto muito longo para o modelo atual. Reduza contexto/historico ou ajuste maxResponseTokens.",
        {
          attempts,
          endpoints: candidates,
        },
      );
    }

    if (lastStructuredError) {
      throw new RagPipelineError(
        lastStructuredError.status,
        lastStructuredError.code,
        `${lastStructuredError.message} Endpoints tentados: ${candidates.join(", ")}.`,
        {
          attempts,
          suggestion: this.buildUnavailableSuggestion(),
        },
      );
    }

    throw new RagPipelineError(503, "RAG_LLM_UNAVAILABLE", `vLLM indisponivel. Endpoints tentados: ${candidates.join(", ")}.`, {
      attempts,
      suggestion: this.buildUnavailableSuggestion(),
    });
  }

  async streamWithContext(input: RagLlmRequest): Promise<ReadableStream<Uint8Array>> {
    if (this.config.requireInternalBaseUrl && !isInternalBaseUrl(this.config.baseUrl)) {
      throw new RagPipelineError(
        500,
        "RAG_LLM_BASE_URL_NOT_INTERNAL",
        "RAG_LLM_BASE_URL deve apontar para endpoint interno (localhost/127.0.0.1).",
      );
    }

    const startedAt = Date.now();
    const candidates = this.resolveCandidates();
    const attempts: LlmEndpointAttempt[] = [];
    const promptProfile = buildPromptInstructionProfile(input.question, input.contextPack, this.config.strictContextOnly);
    logger.info("RAG_LLM_STREAM_START", {
      baseUrl: this.config.baseUrl,
      fallbacks: this.config.fallbackBaseUrls,
      model: this.config.model,
      timeoutMs: this.config.timeoutMs,
      maxTokens: input.maxTokens,
      temperature: input.temperature,
      contextChars: input.contextPack.length,
      historyItems: input.history.length,
      retryAttempts: this.config.retryAttempts,
      strictContextOnly: promptProfile.strictContextOnly,
      hasRetrievedContext: promptProfile.hasRetrievedContext,
      requiresVerifiableContext: promptProfile.requiresVerifiableContext,
      depthPolicy: promptProfile.depthPolicy,
    });

    const normalizedHistory = normalizeHistoryForVllm(input.history);
    const messages = [
      ...normalizedHistory.map((item) => ({ role: item.role, content: item.content })),
      { role: "user", content: buildUserPrompt(input.question, input.contextPack, promptProfile) },
    ];
    const tokenCandidates = buildTokenCandidates(input.maxTokens);

    let lastStructuredError: RagPipelineError | null = null;
    let contextLimitReached = false;

    for (const baseUrl of candidates) {
      const healthy = await this.checkEndpointHealth(baseUrl);
      if (!healthy) {
        attempts.push({ baseUrl, kind: "healthcheck_failed" });
        continue;
      }

      let endpointModel = await this.resolveModelForEndpoint(baseUrl);
      let retriedModelDetection = false;
      let movedToNextEndpoint = false;
      for (let tokenIdx = 0; tokenIdx < tokenCandidates.length; tokenIdx += 1) {
        const maxTokens = tokenCandidates[tokenIdx];
        const isLastTokenAttempt = tokenIdx === tokenCandidates.length - 1;

        for (let retryAttempt = 0; retryAttempt < this.config.retryAttempts; retryAttempt += 1) {
          const controller = new AbortController();
          let timeoutId: ReturnType<typeof setTimeout> | null = null;
          const clearStreamTimeout = () => {
            if (!timeoutId) return;
            clearTimeout(timeoutId);
            timeoutId = null;
          };
          const touchTimeout = () => {
            clearStreamTimeout();
            timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
          };

          try {
            touchTimeout();
            const response = await fetch(`${baseUrl}/chat/completions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.config.apiKey}`,
              },
              body: JSON.stringify({
                model: endpointModel,
                messages,
                temperature: input.temperature,
                max_tokens: maxTokens,
                stream: true,
                seed: input.seed ?? undefined,
              }),
              signal: controller.signal,
            });
            touchTimeout();

            if (RETRYABLE_HTTP_STATUSES.has(response.status) && retryAttempt < this.config.retryAttempts - 1) {
              logger.warn("RAG_LLM_STREAM_HTTP_RETRY", {
                baseUrl,
                status: response.status,
                attempt: retryAttempt + 1,
                maxAttempts: this.config.retryAttempts,
              });
              await response.text().catch(() => "");
              clearStreamTimeout();
              await sleepMs(this.resolveRetryBackoff(retryAttempt));
              continue;
            }

            if (!response.ok) {
              const body = await response.text().catch(() => "");
              const status = response.status;
              const detail = body.trim().slice(0, 240);
              clearStreamTimeout();

              if (isMissingModelError(status, body) && !retriedModelDetection) {
                const refreshedModel = await this.resolveModelForEndpoint(baseUrl, true);
                if (refreshedModel && refreshedModel !== endpointModel) {
                  logger.warn("RAG_LLM_STREAM_MODEL_RETRY", {
                    baseUrl,
                    previousModel: endpointModel,
                    refreshedModel,
                    status,
                  });
                  endpointModel = refreshedModel;
                  retriedModelDetection = true;
                  retryAttempt = this.config.retryAttempts;
                  tokenIdx -= 1;
                  break;
                }
              }

              if (shouldRetryWithLowerTokens(status, body)) {
                if (!isLastTokenAttempt) {
                  logger.warn("RAG_LLM_STREAM_TOKEN_RETRY", {
                    baseUrl,
                    model: endpointModel,
                    status,
                    requestedMaxTokens: input.maxTokens,
                    attemptMaxTokens: maxTokens,
                    nextMaxTokens: tokenCandidates[tokenIdx + 1],
                  });
                  break;
                }
                contextLimitReached = true;
              }

              attempts.push({ baseUrl, kind: "http_error", status, detail });
              lastStructuredError = new RagPipelineError(
                [400, 401, 403, 404, 422].includes(status) ? 422 : 502,
                "RAG_LLM_UPSTREAM_ERROR",
                `Falha ao consultar vLLM (${status})${detail ? `: ${detail}` : "."}`,
              );
              if (RETRYABLE_HTTP_STATUSES.has(status)) {
                this.healthCache.set(baseUrl, { healthy: false, checkedAt: Date.now() });
              }
              movedToNextEndpoint = true;
              break;
            }

            this.preferredBaseUrl = baseUrl;
            this.healthCache.set(baseUrl, { healthy: true, checkedAt: Date.now() });
            attempts.push({ baseUrl, kind: "success" });
            return this.toPlainTextStream(response, {
              baseUrl,
              touchTimeout,
              clearTimeout: clearStreamTimeout,
              startedAt,
              requestedMaxTokens: input.maxTokens,
              usedMaxTokens: maxTokens,
            });
          } catch (error) {
            clearStreamTimeout();
            if (isAbortError(error)) {
              if (retryAttempt < this.config.retryAttempts - 1) {
                logger.warn("RAG_LLM_STREAM_TIMEOUT_RETRY", {
                  baseUrl,
                  timeoutMs: this.config.timeoutMs,
                  attempt: retryAttempt + 1,
                  maxAttempts: this.config.retryAttempts,
                });
                await sleepMs(this.resolveRetryBackoff(retryAttempt));
                continue;
              }
              attempts.push({ baseUrl, kind: "timeout" });
              lastStructuredError = new RagPipelineError(504, "RAG_LLM_TIMEOUT", "Timeout ao consultar o vLLM interno.");
              this.healthCache.set(baseUrl, { healthy: false, checkedAt: Date.now() });
              movedToNextEndpoint = true;
              break;
            }

            const detail = error instanceof Error ? error.message : String(error);
            if (retryAttempt < this.config.retryAttempts - 1) {
              logger.warn("RAG_LLM_STREAM_CONNECTIVITY_RETRY", {
                baseUrl,
                attempt: retryAttempt + 1,
                maxAttempts: this.config.retryAttempts,
                detail,
              });
              await sleepMs(this.resolveRetryBackoff(retryAttempt));
              continue;
            }

            attempts.push({ baseUrl, kind: "unreachable", detail });
            lastStructuredError =
              error instanceof RagPipelineError
                ? error
                : new RagPipelineError(503, "RAG_LLM_UNAVAILABLE", `Falha de conexao com vLLM: ${detail}.`);
            this.healthCache.set(baseUrl, { healthy: false, checkedAt: Date.now() });
            movedToNextEndpoint = true;
            break;
          }
        }

        if (movedToNextEndpoint) break;
        if (contextLimitReached) break;
      }

      if (movedToNextEndpoint) continue;
      if (contextLimitReached) continue;
    }

    if (contextLimitReached) {
      throw new RagPipelineError(
        422,
        "RAG_LLM_CONTEXT_LIMIT",
        "Contexto muito longo para o modelo atual. Reduza contexto/historico ou ajuste maxResponseTokens.",
        {
          attempts,
          endpoints: candidates,
        },
      );
    }

    if (lastStructuredError) {
      throw new RagPipelineError(
        lastStructuredError.status,
        lastStructuredError.code,
        `${lastStructuredError.message} Endpoints tentados: ${candidates.join(", ")}.`,
        {
          attempts,
          suggestion: this.buildUnavailableSuggestion(),
        },
      );
    }

    throw new RagPipelineError(503, "RAG_LLM_UNAVAILABLE", `vLLM indisponivel. Endpoints tentados: ${candidates.join(", ")}.`, {
      attempts,
      suggestion: this.buildUnavailableSuggestion(),
    });
  }
}

export function createVllmInternalClient(rawEnv = process.env) {
  return new VllmInternalClient(loadRagLlmConfig(rawEnv));
}
