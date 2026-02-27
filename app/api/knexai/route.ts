import { NextRequest } from "next/server";
import { LETICIA_SYSTEM_PROMPT } from "@/lib/knexai/spec";

export const runtime = "nodejs";

type ChatRole = "user" | "assistant";
type ChatHistoryItem = { role: ChatRole; content: string };
type ModelChatRole = "system" | "user" | "assistant";
type ModelChatMessage = { role: ModelChatRole; content: string };
type GenerationProfile = {
  temperature: number;
  topP: number;
  maxTokens: number;
  repetitionPenalty: number;
  brevityInstruction: string;
};
type LlmConfig = {
  baseUrl: string;
  model: string;
  modelFallbacks: string[];
  apiKey: string;
  timeoutMs: number;
  contextWindow: number;
  maxTokens: number;
  useMock: boolean;
};
type EngineMode = "direct" | "anm";
type EngineModeConfig = {
  mode: EngineMode;
  anmBaseUrl: string;
  anmTimeoutMs: number;
  anmSoftTimeoutMs: number;
  fallbackToDirect: boolean;
};
type AnmChatResult = {
  answer: string;
  traceId: string | null;
};

const DEFAULT_BASE_URL = "http://127.0.0.1:8000/v1";
const DEFAULT_MODEL = "mistral-awq";
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_TOKENS = 2_048;
const DEFAULT_CONTEXT_WINDOW = 2_048;
const CONTEXT_RESERVE_TOKENS = 256;
const AVAILABLE_MODELS_CACHE_TTL_MS = 30_000;
const DEFAULT_ANM_BASE_URL = "http://127.0.0.1:8100";
const DEFAULT_ANM_TIMEOUT_MS = 45_000;
const DEFAULT_ANM_SOFT_TIMEOUT_MS = 200;

type AvailableModelsCache = {
  baseUrl: string;
  apiKey: string;
  expiresAt: number;
  models: string[];
};

let availableModelsCache: AvailableModelsCache | null = null;

function pickFirstNonEmpty(...values: Array<string | undefined | null>) {
  for (const value of values) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) return trimmed;
  }
  return "";
}

function normalizeTemporalPrompt(prompt: string) {
  return prompt
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[!?.,;:"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCurrentDatePrompt(prompt: string) {
  const normalized = normalizeTemporalPrompt(prompt);
  if (!normalized) return false;
  const patterns = [
    /\b(qual|que)\s+(e|eh)\s+(o\s+)?(dia|data)\s+de\s+hoje\b/,
    /\bqual\s+(o\s+)?(dia|data)\s+de\s+hoje\b/,
    /\bme\s+diga\s+(o\s+)?(dia|data)\s+de\s+hoje\b/,
    /\bque\s+dia\s+(e|eh)\s+hoje\b/,
    /\bhoje\s+(e|eh)\s+que\s+dia\b/,
    /\bwhat\s+day\s+is\s+it\s+today\b/,
    /\bwhat\s+is\s+todays?\s+date\b/,
    /\btodays?\s+date\b/,
  ];
  return patterns.some((pattern) => pattern.test(normalized));
}

function buildCurrentDateContext() {
  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const locale = "pt-BR";
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone }).format(now);
  const date = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "long", year: "numeric", timeZone }).format(now);
  return {
    weekday,
    date,
    timeZone,
    line: `Data atual de referencia: ${weekday}, ${date} (fuso ${timeZone}).`,
  };
}

function buildCurrentDateAnswer() {
  const current = buildCurrentDateContext();
  return `Hoje e ${current.weekday}, ${current.date}. (Fuso: ${current.timeZone})`;
}

function resolveLogicalModelName() {
  const explicit = pickFirstNonEmpty(process.env.LLM_MODEL_NAME);
  if (explicit) return explicit;

  const legacy = pickFirstNonEmpty(process.env.VLLM_MODEL);
  // VLLM_MODEL historicamente pode receber caminho de disco. No payload OpenAI-like, usar nome logico.
  if (legacy && !legacy.includes("/") && !legacy.includes("\\")) return legacy;

  return DEFAULT_MODEL;
}

function resolveModelFallbacks(primaryModel: string) {
  const localModelPath = pickFirstNonEmpty(process.env.LOCAL_LLM_MODEL);
  const localModelPathBasename = localModelPath.replace(/\\/g, "/").split("/").filter(Boolean).pop() || "";
  const candidates = [
    pickFirstNonEmpty(process.env.VLLM_MODEL),
    localModelPath,
    localModelPathBasename,
    "models/CModelosMistral-7B-Instruct-v0.2-AWQ",
  ]
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(candidates)).filter((value) => value !== primaryModel);
}

class LlmRouteError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function readLlmConfig(): LlmConfig {
  const baseUrl = pickFirstNonEmpty(process.env.LOCAL_LLM_BASE_URL, process.env.LLM_BASE_URL, process.env.VLLM_BASE_URL, DEFAULT_BASE_URL).replace(
    /\/+$/,
    "",
  );
  const model = resolveLogicalModelName();
  const modelFallbacks = resolveModelFallbacks(model);
  const apiKey = pickFirstNonEmpty(process.env.LOCAL_LLM_API_KEY, process.env.VLLM_API_KEY, process.env.LLM_API_KEY, "token-local");
  const parsedTimeout = Number(process.env.LLM_TIMEOUT_MS || process.env.VLLM_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(parsedTimeout) ? Math.max(3_000, parsedTimeout) : DEFAULT_TIMEOUT_MS;
  const parsedContextWindow = Number(process.env.LLM_CONTEXT_WINDOW || process.env.VLLM_CONTEXT_WINDOW || DEFAULT_CONTEXT_WINDOW);
  const contextWindow = Number.isFinite(parsedContextWindow) ? Math.max(512, Math.round(parsedContextWindow)) : DEFAULT_CONTEXT_WINDOW;
  const parsedMaxTokens = Number(process.env.LLM_MAX_TOKENS || process.env.VLLM_MAX_TOKENS || DEFAULT_MAX_TOKENS);
  const requestedMaxTokens = Number.isFinite(parsedMaxTokens) ? Math.max(64, Math.round(parsedMaxTokens)) : DEFAULT_MAX_TOKENS;
  const maxByContext = Math.max(64, contextWindow - CONTEXT_RESERVE_TOKENS);
  const maxTokens = Math.min(requestedMaxTokens, maxByContext);
  const useMock = process.env.LETICIA_MOCK === "1";
  return { baseUrl, model, modelFallbacks, apiKey, timeoutMs, contextWindow, maxTokens, useMock };
}

function readEngineModeConfig(): EngineModeConfig {
  const modeRaw = pickFirstNonEmpty(process.env.KNEXAI_ENGINE_MODE, "direct").toLowerCase();
  const mode: EngineMode = modeRaw === "anm" ? "anm" : "direct";
  const anmBaseUrl = pickFirstNonEmpty(process.env.ANM_BACKEND_BASE_URL, DEFAULT_ANM_BASE_URL).replace(/\/+$/, "");
  const parsedAnmTimeout = Number(process.env.ANM_BACKEND_TIMEOUT_MS || DEFAULT_ANM_TIMEOUT_MS);
  const anmTimeoutMs = Number.isFinite(parsedAnmTimeout) ? Math.max(3_000, Math.round(parsedAnmTimeout)) : DEFAULT_ANM_TIMEOUT_MS;
  const parsedAnmSoftTimeout = Number(process.env.KNEXAI_ANM_SOFT_TIMEOUT_MS || DEFAULT_ANM_SOFT_TIMEOUT_MS);
  const anmSoftTimeoutMs = Number.isFinite(parsedAnmSoftTimeout)
    ? Math.max(200, Math.min(anmTimeoutMs, Math.round(parsedAnmSoftTimeout)))
    : DEFAULT_ANM_SOFT_TIMEOUT_MS;
  const fallbackRaw = pickFirstNonEmpty(process.env.KNEXAI_ANM_FALLBACK_TO_DIRECT, "1").toLowerCase();
  const fallbackToDirect = !["0", "false", "no", "off"].includes(fallbackRaw);
  return { mode, anmBaseUrl, anmTimeoutMs, anmSoftTimeoutMs, fallbackToDirect };
}

function safeBackendError(status: number, code: string, message: string) {
  return Response.json({ code, message }, { status });
}

function normalizeHistory(value: unknown): ChatHistoryItem[] {
  if (!Array.isArray(value)) return [];
  const items: ChatHistoryItem[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const role = (candidate as { role?: unknown }).role;
    const content = (candidate as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const trimmed = content.trim();
    if (!trimmed) continue;
    items.push({ role, content: trimmed });
  }
  // Mantem historico recente para reduzir deriva de tema.
  return items.slice(-8);
}

function sanitizeHistoryForModel(history: ChatHistoryItem[]): ChatHistoryItem[] {
  const sanitized: ChatHistoryItem[] = [];
  for (const item of history) {
    const content = item.content.trim();
    if (!content) continue;

    // Alguns templates exigem que o historico comecem por "user".
    if (!sanitized.length && item.role === "assistant") continue;

    const last = sanitized[sanitized.length - 1];
    if (!last) {
      sanitized.push({ role: item.role, content });
      continue;
    }

    // Consolida papeis repetidos para manter alternancia user/assistant.
    if (last.role === item.role) {
      last.content = `${last.content}\n${content}`.trim();
      continue;
    }

    sanitized.push({ role: item.role, content });
  }

  return sanitized;
}

function ensurePrompt(history: ChatHistoryItem[], prompt: string): ChatHistoryItem[] {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) return history;
  const last = history[history.length - 1];
  if (last?.role === "user" && last.content === trimmedPrompt) return history;
  return [...history, { role: "user", content: trimmedPrompt }];
}

function resolveEffectiveHistory(history: ChatHistoryItem[], prompt: string): ChatHistoryItem[] {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) return history;

  // Saudacoes/encerramentos devem ser tratados como turno atual isolado para evitar deriva para tema antigo.
  if (isMicroSocialPrompt(trimmedPrompt)) {
    return [{ role: "user", content: trimmedPrompt }];
  }

  return history;
}

function truncateHistoryContent(content: string, maxChars: number) {
  const normalized = content.trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(32, maxChars - 3)).trimEnd()}...`;
}

function optimizeHistoryForLatency(history: ChatHistoryItem[], prompt: string): ChatHistoryItem[] {
  if (!history.length) return history;
  const complexity = classifyPromptComplexity(prompt);
  const last = history[history.length - 1];
  if (!last) return history;

  if (complexity === "micro") {
    return [{ role: "user", content: truncateHistoryContent(last.content, 320) }];
  }

  const limitsByComplexity: Record<PromptComplexity, { maxItems: number; charBudget: number; maxPerMessage: number; maxLast: number }> = {
    micro: { maxItems: 1, charBudget: 0, maxPerMessage: 320, maxLast: 320 },
    direct: { maxItems: 3, charBudget: 700, maxPerMessage: 360, maxLast: 460 },
    short: { maxItems: 5, charBudget: 1200, maxPerMessage: 520, maxLast: 560 },
    medium: { maxItems: 7, charBudget: 2200, maxPerMessage: 760, maxLast: 760 },
    complex: { maxItems: 9, charBudget: 3200, maxPerMessage: 1000, maxLast: 1000 },
  };
  const limits = limitsByComplexity[complexity];
  const previous = history.slice(0, -1);
  const selectedReversed: ChatHistoryItem[] = [];
  let usedChars = 0;

  for (let idx = previous.length - 1; idx >= 0; idx -= 1) {
    if (selectedReversed.length >= Math.max(0, limits.maxItems - 1)) break;
    const item = previous[idx];
    const compact = truncateHistoryContent(item.content, limits.maxPerMessage);
    if (!compact) continue;
    if (usedChars + compact.length > limits.charBudget) break;
    usedChars += compact.length;
    selectedReversed.push({ role: item.role, content: compact });
  }

  selectedReversed.reverse();
  return [...selectedReversed, { role: last.role, content: truncateHistoryContent(last.content, limits.maxLast) }];
}

function isShortPrompt(prompt: string) {
  const normalized = prompt.trim();
  if (!normalized) return true;
  const words = normalized.split(/\s+/).filter(Boolean);
  return normalized.length <= 90 && words.length <= 16;
}

type PromptComplexity = "micro" | "direct" | "short" | "medium" | "complex";

function isMicroSocialPrompt(prompt: string): boolean {
  const normalized = prompt.trim();
  if (!normalized) return false;

  const lowered = normalized.toLowerCase();
  const compact = lowered
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[!?.,;:"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = compact.split(" ").filter(Boolean);
  if (words.length > 8 || normalized.length > 60) return false;

  const microSocialPatterns = [
    /^(oi|ola|olá|e ai|eae|opa|hey|hello)$/i,
    /^(bom dia|boa tarde|boa noite)$/i,
    /^(blz|beleza|tudo bem|td bem|como vai)$/i,
    /^(nada por agora|nada agora|de boa|tranquilo|ok|okay|ok obrigado|obrigado|obg|valeu)$/i,
    /^(ate logo|até logo|ate mais|até mais|tchau|falou|ate breve|até breve)$/i,
  ];

  return microSocialPatterns.some((pattern) => pattern.test(compact));
}

function classifyPromptComplexity(prompt: string): PromptComplexity {
  const normalized = prompt.trim();
  if (!normalized) return "short";
  if (isMicroSocialPrompt(normalized)) return "micro";

  const lowered = normalized.toLowerCase();
  const words = normalized.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const charCount = normalized.length;

  const directIntentPatterns = [
    /\b(sin[oô]nimo|sinonimo|sin[oô]nimos|sinonimos|ant[oô]nimo|antonimo|ant[oô]nimos|antonimos)\b/i,
    /\b(traduz|traduza|tradu[cç][aã]o|translation)\b/i,
    /\b(defina|defini[cç][aã]o|o que significa|significa)\b/i,
    /\b(corrija|corre[cç][aã]o|ortografia|gram[áa]tica)\b/i,
    /\b(responda em uma frase|responda curto|resuma em uma frase|bem curto)\b/i,
  ];
  const directIntent = directIntentPatterns.some((pattern) => pattern.test(normalized));
  if (directIntent && wordCount <= 24) return "direct";

  const complexSignals = [
    "explique em detalhes",
    "detalhe",
    "aprofunde",
    "analise",
    "compare",
    "passo a passo",
    "arquitetura",
    "estrategia",
    "estratégia",
    "plano",
    "trade-off",
    "vantagens e desvantagens",
    "como funciona",
    "por que",
    "porque",
  ];
  const hasComplexSignal = complexSignals.some((signal) => lowered.includes(signal));
  if (hasComplexSignal || wordCount >= 45 || charCount >= 260) return "complex";

  if (wordCount <= 6 && !hasComplexSignal) return "direct";
  if (isShortPrompt(normalized)) return "short";
  return "medium";
}

function resolveGenerationProfile(prompt: string, config: LlmConfig): GenerationProfile {
  const complexity = classifyPromptComplexity(prompt);

  if (complexity === "micro") {
    return {
      temperature: 0.08,
      topP: 0.72,
      maxTokens: Math.min(config.maxTokens, 40),
      repetitionPenalty: 1.2,
      brevityInstruction:
        "Interacao social minima: responda em 1 frase curtissima (ate 12 palavras), sem convite extra e sem prolongar conversa.",
    };
  }

  if (complexity === "direct") {
    return {
      temperature: 0.12,
      topP: 0.8,
      maxTokens: Math.min(config.maxTokens, 96),
      repetitionPenalty: 1.12,
      brevityInstruction:
        "Resposta objetiva e pontual: va direto ao ponto em no maximo 2 frases curtas (ou lista curta), sem explicacao longa.",
    };
  }

  if (complexity === "short") {
    return {
      temperature: 0.2,
      topP: 0.85,
      maxTokens: Math.min(config.maxTokens, 240),
      repetitionPenalty: 1.16,
      brevityInstruction:
        "Resposta curta e direta: use no maximo 3 frases curtas, sem repeticao de palavras e sem rodeios.",
    };
  }

  if (complexity === "medium") {
    return {
      temperature: 0.28,
      topP: 0.9,
      maxTokens: Math.min(config.maxTokens, 700),
      repetitionPenalty: 1.1,
      brevityInstruction:
        "Resposta equilibrada: explique com clareza e profundidade moderada, em 1 a 3 paragrafos curtos, com exemplos quando util.",
    };
  }

  return {
    temperature: 0.32,
    topP: 0.92,
    maxTokens: Math.min(config.maxTokens, 1200),
    repetitionPenalty: 1.08,
    brevityInstruction:
      "Resposta aprofundada e estruturada: traga contexto, explicacao tecnica, trade-offs e conclusao pratica, sem repeticoes.",
  };
}

function buildSystemInstruction(profile: GenerationProfile) {
  const currentDate = buildCurrentDateContext();
  return [
    LETICIA_SYSTEM_PROMPT.trim(),
    "",
    currentDate.line,
    "Para perguntas com termos relativos (hoje, amanha, ontem), use essa data de referencia.",
    "",
    "Regras criticas desta resposta:",
    "- Responda exclusivamente a pergunta mais recente do usuario.",
    "- Use historico apenas se for diretamente relevante para a pergunta atual.",
    "- Nao invente fatos, termos tecnicos, ingredientes, nomes ou numeros.",
    "- Se houver incerteza factual, diga explicitamente que nao tem certeza.",
    "",
    `Diretriz de estilo: ${profile.brevityInstruction}`,
  ].join("\n");
}

function buildChatMessages(history: ChatHistoryItem[], profile: GenerationProfile): ModelChatMessage[] {
  if (!history.length) return [];
  return [{ role: "system", content: buildSystemInstruction(profile) }, ...history];
}

function buildCompletionPrompt(history: ChatHistoryItem[], profile: GenerationProfile) {
  const currentDate = buildCurrentDateContext();
  const lines = [LETICIA_SYSTEM_PROMPT.trim()];
  lines.push(currentDate.line);
  lines.push("Para perguntas com termos relativos (hoje, amanha, ontem), use essa data de referencia.");
  lines.push("Regras criticas: responda apenas a pergunta mais recente; use historico apenas se relevante; nao invente fatos.");
  lines.push(`Diretriz de estilo: ${profile.brevityInstruction}`);
  history.forEach((item) => {
    const prefix = item.role === "assistant" ? "Assistente" : "Usuario";
    lines.push(`${prefix}: ${item.content}`);
  });
  lines.push("Assistente:");
  return lines.join("\n\n");
}

async function callLlm(url: string, payload: Record<string, unknown>, config: LlmConfig) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new LlmRouteError(504, "LLM_TIMEOUT", "Tempo limite ao consultar o motor de IA.");
    }
    const maybeCause = typeof error === "object" && error && "cause" in error ? (error as { cause?: { code?: string } }).cause : null;
    const code = maybeCause?.code || "";
    const connectivityCodes = new Set(["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EHOSTUNREACH"]);
    const suffix = connectivityCodes.has(code) ? ` (${code})` : "";
    throw new LlmRouteError(
      503,
      "LLM_UNAVAILABLE",
      `Motor local indisponivel em ${config.baseUrl}. Verifique se o vLLM esta ativo e acessivel${suffix}.`,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function resolveModelCandidates(config: LlmConfig, availableModels: string[]) {
  const configuredCandidates = Array.from(new Set([config.model, ...config.modelFallbacks].map((value) => value.trim()).filter(Boolean)));
  if (!availableModels.length) return configuredCandidates;

  const availableSet = new Set(availableModels);
  const configuredAvailable = configuredCandidates.filter((candidate) => availableSet.has(candidate));
  if (configuredAvailable.length > 0) {
    return Array.from(new Set([...configuredAvailable, ...configuredCandidates, ...availableModels]));
  }

  return Array.from(new Set([...availableModels, ...configuredCandidates]));
}

async function fetchAvailableModels(config: LlmConfig): Promise<string[]> {
  const now = Date.now();
  if (
    availableModelsCache &&
    availableModelsCache.baseUrl === config.baseUrl &&
    availableModelsCache.apiKey === config.apiKey &&
    availableModelsCache.expiresAt > now
  ) {
    return availableModelsCache.models;
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(1_500, Math.min(6_000, Math.floor(config.timeoutMs / 6)));
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${config.baseUrl}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json().catch(() => null)) as
      | { data?: Array<{ id?: unknown }>; models?: Array<{ id?: unknown } | string> }
      | null;
    if (!payload) {
      return [];
    }

    const fromData = Array.isArray(payload.data)
      ? payload.data.map((entry) => (typeof entry?.id === "string" ? entry.id.trim() : "")).filter(Boolean)
      : [];
    const fromModels = Array.isArray(payload.models)
      ? payload.models
          .map((entry) => {
            if (typeof entry === "string") return entry.trim();
            if (entry && typeof entry === "object" && "id" in entry) {
              const candidate = (entry as { id?: unknown }).id;
              return typeof candidate === "string" ? candidate.trim() : "";
            }
            return "";
          })
          .filter(Boolean)
      : [];

    const models = Array.from(new Set([...fromData, ...fromModels]));
    availableModelsCache = {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      models,
      expiresAt: Date.now() + AVAILABLE_MODELS_CACHE_TTL_MS,
    };
    return models;
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

type ExtractedChunk = {
  mode: "delta" | "full";
  text: string;
};

function extractTextFromChunk(payload: unknown, options?: { streaming?: boolean }): ExtractedChunk {
  if (!payload || typeof payload !== "object") return { mode: "full", text: "" };
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices.length) return { mode: "full", text: "" };
  const first = choices[0] as { delta?: { content?: unknown }; message?: { content?: unknown }; text?: unknown };
  if (typeof first?.delta?.content === "string") return { mode: "delta", text: first.delta.content };
  if (typeof first?.message?.content === "string") return { mode: "full", text: first.message.content };
  if (typeof first?.text === "string") {
    // OpenAI-like /completions: em streaming, `choices[0].text` eh delta; sem stream, eh texto final.
    return { mode: options?.streaming ? "delta" : "full", text: first.text };
  }
  return { mode: "full", text: "" };
}

function resolveDeltaFromFullText(previous: string, incoming: string) {
  if (!incoming) return { delta: "", nextState: previous };
  if (!previous) return { delta: incoming, nextState: incoming };
  if (incoming === previous) return { delta: "", nextState: previous };

  if (incoming.startsWith(previous)) {
    return { delta: incoming.slice(previous.length), nextState: incoming };
  }

  if (previous.startsWith(incoming)) {
    return { delta: "", nextState: previous };
  }

  if (incoming.includes(previous)) {
    const idx = incoming.indexOf(previous);
    return { delta: incoming.slice(idx + previous.length), nextState: incoming };
  }

  if (previous.includes(incoming)) {
    return { delta: "", nextState: previous };
  }

  let overlap = 0;
  const maxOverlap = Math.min(previous.length, incoming.length);
  for (let size = maxOverlap; size > 0; size -= 1) {
    if (previous.slice(-size) === incoming.slice(0, size)) {
      overlap = size;
      break;
    }
  }

  return { delta: incoming.slice(overlap), nextState: incoming };
}

async function mapNonStreamingToText(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => null);
    const text = extractTextFromChunk(payload, { streaming: false }).text;
    if (!text) {
      throw new LlmRouteError(502, "LLM_INVALID_RESPONSE", "Resposta invalida do motor de IA.");
    }
    return text;
  }
  const plain = await response.text();
  if (!plain.trim()) {
    throw new LlmRouteError(502, "LLM_EMPTY_RESPONSE", "Motor de IA retornou resposta vazia.");
  }
  return plain;
}

function createChunkedTextStream(text: string, chunkSize = 320) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (!text) {
        controller.close();
        return;
      }
      for (let index = 0; index < text.length; index += chunkSize) {
        controller.enqueue(encoder.encode(text.slice(index, index + chunkSize)));
      }
      controller.close();
    },
  });
}

function resolveAnmAnswer(payload: unknown): AnmChatResult {
  if (!payload || typeof payload !== "object") {
    throw new LlmRouteError(502, "ANM_INVALID_RESPONSE", "ANM retornou payload invalido.");
  }
  const candidate = payload as {
    answer?: unknown;
    text?: unknown;
    output?: unknown;
    trace_id?: unknown;
    traceId?: unknown;
  };
  const answerRaw =
    typeof candidate.answer === "string"
      ? candidate.answer
      : typeof candidate.text === "string"
        ? candidate.text
        : typeof candidate.output === "string"
          ? candidate.output
          : "";
  const answer = answerRaw.trim();
  if (!answer) {
    throw new LlmRouteError(502, "ANM_EMPTY_RESPONSE", "ANM nao retornou resposta textual.");
  }
  const traceCandidate = typeof candidate.trace_id === "string" ? candidate.trace_id : typeof candidate.traceId === "string" ? candidate.traceId : "";
  return { answer, traceId: traceCandidate || null };
}

async function requestAnmChat(config: EngineModeConfig, prompt: string): Promise<AnmChatResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.anmTimeoutMs);
  try {
    const response = await fetch(`${config.anmBaseUrl}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: prompt }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      const detail = responseText.trim().slice(0, 240);
      throw new LlmRouteError(
        response.status >= 500 ? 503 : 502,
        "ANM_UPSTREAM_ERROR",
        `ANM respondeu com erro HTTP ${response.status}${detail ? ` (${detail})` : ""}.`,
      );
    }

    const payload = await response.json().catch(() => null);
    return resolveAnmAnswer(payload);
  } catch (error) {
    if (error instanceof LlmRouteError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new LlmRouteError(504, "ANM_TIMEOUT", "Tempo limite ao consultar o ANM backend.");
    }
    throw new LlmRouteError(503, "ANM_UNAVAILABLE", `ANM backend indisponivel em ${config.anmBaseUrl}.`);
  } finally {
    clearTimeout(timeoutId);
  }
}

function sseToPlainTextStream(response: Response) {
  if (!response.body) {
    throw new LlmRouteError(502, "LLM_EMPTY_STREAM", "Motor de IA nao retornou stream.");
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let emittedAny = false;
  let fullTextState = "";
  const mergeChunk = (chunk: ExtractedChunk) => {
    const incoming = chunk.text;
    if (!incoming) return "";

    // Modo delta: anexa diretamente e trata apenas casos claros de replay cumulativo.
    if (chunk.mode === "delta") {
      if (!fullTextState) {
        fullTextState = incoming;
        return incoming;
      }
      if (incoming === fullTextState) return "";
      if (incoming.startsWith(fullTextState)) {
        const delta = incoming.slice(fullTextState.length);
        fullTextState = incoming;
        return delta;
      }
      fullTextState += incoming;
      return incoming;
    }

    // Modo full/cumulativo: reconcilia com o estado previamente emitido.
    const { delta, nextState } = resolveDeltaFromFullText(fullTextState, incoming);
    fullTextState = nextState;
    return delta;
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = response.body!.getReader();
      let buffer = "";
      let closed = false;
      const safeClose = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (!data) continue;
            if (data === "[DONE]") {
              safeClose();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const extracted = extractTextFromChunk(parsed, { streaming: true });
              const delta = mergeChunk(extracted);
              if (!delta) continue;
              emittedAny = true;
              controller.enqueue(encoder.encode(delta));
            } catch {
              continue;
            }
          }
        }
      } catch (error) {
        console.error("KNEXAI_STREAM_ERROR", error);
      } finally {
        safeClose();
      }
    },
  });

  return { stream, emittedAny: () => emittedAny };
}

async function requestLlmStreaming(config: LlmConfig, history: ChatHistoryItem[], prompt: string) {
  const chatUrl = `${config.baseUrl}/chat/completions`;
  const completionUrl = `${config.baseUrl}/completions`;
  const profile = resolveGenerationProfile(prompt, config);
  const tokenCandidates = Array.from(
    new Set(
      [profile.maxTokens, Math.floor(profile.maxTokens * 0.75), Math.floor(profile.maxTokens * 0.5), 512, 384, 256, 128]
        .map((value) => Math.max(64, value))
        .filter((value) => Number.isFinite(value)),
    ),
  );

  const isTokenLimitFailure = (status: number, body: string) => {
    if (![400, 413, 422].includes(status)) return false;
    const signal = `${body || ""}`.toLowerCase();
    return /(max.?tokens|max_model_len|context|too long|exceed|token)/i.test(signal);
  };
  const isModelNotFoundFailure = (status: number, body: string) => {
    if (status !== 404) return false;
    const signal = `${body || ""}`.toLowerCase();
    return /(model).*(does not exist|not found|unknown)/i.test(signal) || /notfounderror/i.test(signal);
  };

  const shouldFallbackToCompletions = (status: number) => [400, 404, 405, 422].includes(status);
  let tokenLimitDetected = false;
  const triedModels: string[] = [];
  const availableModels = await fetchAvailableModels(config);
  const modelCandidates = resolveModelCandidates(config, availableModels);

  if (availableModels.length > 0 && modelCandidates[0] !== config.model) {
    console.warn("KNEXAI_MODEL_REORDER", {
      requestedModel: config.model,
      selectedFirstModel: modelCandidates[0],
      availableModels,
    });
  }

  const requestWithModel = async (modelName: string): Promise<Response> => {
    let chatFailure: { status: number; body: string } | null = null;

    for (let index = 0; index < tokenCandidates.length; index += 1) {
      const maxTokens = tokenCandidates[index];
      const isLastCandidate = index === tokenCandidates.length - 1;
      const chatPayload = {
        model: modelName,
        messages: buildChatMessages(history, profile),
        temperature: profile.temperature,
        top_p: profile.topP,
        repetition_penalty: profile.repetitionPenalty,
        max_tokens: maxTokens,
        stream: true,
      };

      const chatResponse = await callLlm(chatUrl, chatPayload, config);
      if (chatResponse.ok) return chatResponse;

      const body = await chatResponse.text().catch(() => "");
      chatFailure = { status: chatResponse.status, body };
      if (isModelNotFoundFailure(chatResponse.status, body)) {
        throw new LlmRouteError(404, "LLM_MODEL_NOT_FOUND", `Modelo '${modelName}' nao encontrado no motor local.`);
      }
      if (isTokenLimitFailure(chatResponse.status, body)) {
        tokenLimitDetected = true;
        console.warn("KNEXAI_CHAT_TOKEN_RETRY", {
          status: chatResponse.status,
          model: modelName,
          maxTokens,
          nextAttempt: !isLastCandidate,
        });
        if (!isLastCandidate) continue;
      }
      if (!shouldFallbackToCompletions(chatResponse.status)) {
        console.error("KNEXAI_CHAT_ERROR", {
          status: chatResponse.status,
          model: modelName,
          bodySnippet: body.slice(0, 300),
        });
        throw new LlmRouteError(502, "LLM_UPSTREAM_ERROR", `Motor de IA retornou erro upstream (status ${chatResponse.status}).`);
      }
      break;
    }

    if (chatFailure) {
      console.warn("KNEXAI_CHAT_FALLBACK", {
        status: chatFailure.status,
        model: modelName,
        bodySnippet: chatFailure.body.slice(0, 300),
      });
    }

    for (let index = 0; index < tokenCandidates.length; index += 1) {
      const maxTokens = tokenCandidates[index];
      const isLastCandidate = index === tokenCandidates.length - 1;
      const completionPayload = {
        model: modelName,
        prompt: buildCompletionPrompt(history, profile),
        temperature: profile.temperature,
        top_p: profile.topP,
        repetition_penalty: profile.repetitionPenalty,
        max_tokens: maxTokens,
        stream: true,
      };

      const completionResponse = await callLlm(completionUrl, completionPayload, config);
      if (completionResponse.ok) return completionResponse;

      const completionErrorBody = await completionResponse.text().catch(() => "");
      if (isModelNotFoundFailure(completionResponse.status, completionErrorBody)) {
        throw new LlmRouteError(404, "LLM_MODEL_NOT_FOUND", `Modelo '${modelName}' nao encontrado no motor local.`);
      }
      if (isTokenLimitFailure(completionResponse.status, completionErrorBody)) {
        tokenLimitDetected = true;
        console.warn("KNEXAI_COMPLETION_TOKEN_RETRY", {
          status: completionResponse.status,
          model: modelName,
          maxTokens,
          nextAttempt: !isLastCandidate,
        });
        if (!isLastCandidate) continue;
      }

      console.error("KNEXAI_COMPLETION_ERROR", {
        status: completionResponse.status,
        model: modelName,
        bodySnippet: completionErrorBody.slice(0, 300),
      });
      throw new LlmRouteError(502, "LLM_UPSTREAM_ERROR", `Motor de IA retornou erro upstream (status ${completionResponse.status}).`);
    }

    throw new LlmRouteError(502, "LLM_UPSTREAM_ERROR", "Falha ao consultar o motor de IA.");
  };

  for (const modelName of modelCandidates) {
    triedModels.push(modelName);
    try {
      return await requestWithModel(modelName);
    } catch (error) {
      if (error instanceof LlmRouteError && error.code === "LLM_MODEL_NOT_FOUND") {
        console.warn("KNEXAI_MODEL_FALLBACK", {
          requestedModel: config.model,
          attemptedModel: modelName,
          nextModel: modelCandidates.find((candidate) => !triedModels.includes(candidate)) || null,
        });
        continue;
      }
      throw error;
    }
  }

  if (tokenLimitDetected) {
    throw new LlmRouteError(
      422,
      "LLM_CONTEXT_LIMIT",
      "Contexto muito longo para o modelo atual. Reduza o historico ou ajuste LLM_MAX_TOKENS.",
    );
  }

  throw new LlmRouteError(
    502,
    "LLM_MODEL_NOT_FOUND",
    `Modelo logico '${config.model}' nao foi encontrado no motor local. Modelos tentados: ${triedModels.join(", ")}. ` +
      "Ajuste LLM_MODEL_NAME ou suba o vLLM com --served-model-name mistral-awq.",
  );
}

async function toClientTextStreamResponse(upstream: Response): Promise<Response> {
  const contentType = upstream.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    const { stream } = sseToPlainTextStream(upstream);
    return new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const text = await mapNonStreamingToText(upstream);
  return new Response(text, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function buildMockStream(prompt: string) {
  const encoder = new TextEncoder();
  const text =
    "Ola! Eu sou a Leticia (modo teste).\n" +
    `Recebi sua mensagem: "${prompt.slice(0, 200)}".\n` +
    "Streaming local em funcionamento.\n";
  let i = 0;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const timer = setInterval(() => {
        if (i >= text.length) {
          clearInterval(timer);
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(text[i]));
        i += 1;
      }, 8);
    },
  });
}

export async function GET() {
  const config = readLlmConfig();
  const engineMode = readEngineModeConfig();
  return Response.json(
    {
      ok: true,
      endpoint: "/api/knexai",
      provider: engineMode.mode === "anm" ? "anm-backend" : "openai-compatible",
      engineMode: engineMode.mode,
      anmBaseUrl: engineMode.anmBaseUrl,
      anmSoftTimeoutMs: engineMode.anmSoftTimeoutMs,
      anmFallbackToDirect: engineMode.fallbackToDirect,
      baseUrl: config.baseUrl,
      model: config.model,
      modelFallbacks: config.modelFallbacks,
      contextWindow: config.contextWindow,
      maxTokens: config.maxTokens,
      mock: config.useMock,
    },
    { status: 200 },
  );
}

export async function POST(req: NextRequest) {
  const config = readLlmConfig();
  const engineMode = readEngineModeConfig();

  try {
    const { prompt = "", history = [] } = await req.json().catch(() => ({ prompt: "", history: [] }));
    const safePrompt = typeof prompt === "string" ? prompt.trim() : "";
    if (!safePrompt) {
      return safeBackendError(400, "EMPTY_PROMPT", "Informe a mensagem atual em 'prompt' para enviar ao modelo.");
    }
    if (isCurrentDatePrompt(safePrompt)) {
      return new Response(createChunkedTextStream(buildCurrentDateAnswer()), {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    const safeHistory = sanitizeHistoryForModel(ensurePrompt(normalizeHistory(history), safePrompt));
    const effectiveHistory = optimizeHistoryForLatency(resolveEffectiveHistory(safeHistory, safePrompt), safePrompt);

    if (config.useMock) {
      return new Response(buildMockStream(safePrompt), {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    if (engineMode.mode === "anm") {
      if (engineMode.fallbackToDirect) {
        const anmPromise = requestAnmChat({ ...engineMode, anmTimeoutMs: engineMode.anmSoftTimeoutMs }, safePrompt)
          .then((anm) => ({ source: "anm" as const, ok: true as const, anm }))
          .catch((error: unknown) => ({ source: "anm" as const, ok: false as const, error }));
        const directPromise = requestLlmStreaming(config, effectiveHistory, safePrompt)
          .then((upstream) => ({ source: "direct" as const, ok: true as const, upstream }))
          .catch((error: unknown) => ({ source: "direct" as const, ok: false as const, error }));

        const first = await Promise.race([anmPromise, directPromise]);
        if (first.ok && first.source === "anm") {
          console.info("KNEXAI_ANM_CHAT_OK", {
            traceId: first.anm.traceId,
            anmBaseUrl: engineMode.anmBaseUrl,
            answerChars: first.anm.answer.length,
          });
          const headers: Record<string, string> = { "Content-Type": "text/plain; charset=utf-8" };
          if (first.anm.traceId) headers["X-KnexAI-Trace-Id"] = first.anm.traceId;
          return new Response(createChunkedTextStream(first.anm.answer), {
            status: 200,
            headers,
          });
        }
        if (first.ok && first.source === "direct") {
          return toClientTextStreamResponse(first.upstream);
        }
        if (!first.ok && first.source === "anm") {
          const err = first.error;
          if (err instanceof LlmRouteError) {
            console.warn("KNEXAI_ANM_FALLBACK_TO_DIRECT", {
              code: err.code,
              status: err.status,
              message: err.message,
            });
          }
          const second = await directPromise;
          if (second.ok && second.source === "direct") {
            return toClientTextStreamResponse(second.upstream);
          }
          if (!second.ok && second.source === "direct" && second.error instanceof LlmRouteError) {
            throw second.error;
          }
          throw new LlmRouteError(503, "LLM_UNAVAILABLE", "Falha ao consultar ANM e stream direto.");
        }
        if (!first.ok && first.source === "direct") {
          const second = await anmPromise;
          if (second.ok && second.source === "anm") {
            console.info("KNEXAI_ANM_CHAT_OK", {
              traceId: second.anm.traceId,
              anmBaseUrl: engineMode.anmBaseUrl,
              answerChars: second.anm.answer.length,
            });
            const headers: Record<string, string> = { "Content-Type": "text/plain; charset=utf-8" };
            if (second.anm.traceId) headers["X-KnexAI-Trace-Id"] = second.anm.traceId;
            return new Response(createChunkedTextStream(second.anm.answer), {
              status: 200,
              headers,
            });
          }
          if (!second.ok && second.source === "anm" && second.error instanceof LlmRouteError) {
            throw second.error;
          }
          throw new LlmRouteError(503, "LLM_UNAVAILABLE", "Falha ao consultar stream direto e ANM.");
        }
      } else {
        const anm = await requestAnmChat(engineMode, safePrompt);
        console.info("KNEXAI_ANM_CHAT_OK", {
          traceId: anm.traceId,
          anmBaseUrl: engineMode.anmBaseUrl,
          answerChars: anm.answer.length,
        });
        const headers: Record<string, string> = { "Content-Type": "text/plain; charset=utf-8" };
        if (anm.traceId) headers["X-KnexAI-Trace-Id"] = anm.traceId;
        return new Response(createChunkedTextStream(anm.answer), {
          status: 200,
          headers,
        });
      }
    }

    const upstream = await requestLlmStreaming(config, effectiveHistory, safePrompt);
    return toClientTextStreamResponse(upstream);
  } catch (error) {
    if (error instanceof LlmRouteError) {
      console.error("KNEXAI_LLM_ERROR", { code: error.code, status: error.status, message: error.message });
      return safeBackendError(error.status, error.code, error.message);
    }
    console.error("KNEXAI_POST_UNEXPECTED_ERROR", error);
    return safeBackendError(500, "INTERNAL_ERROR", "Erro interno ao processar a requisicao.");
  }
}
