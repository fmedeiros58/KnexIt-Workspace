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
  apiKey: string;
  timeoutMs: number;
  contextWindow: number;
  maxTokens: number;
  useMock: boolean;
};

const DEFAULT_BASE_URL = "http://127.0.0.1:8000/v1";
const DEFAULT_MODEL = "mistral-awq";
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_TOKENS = 2_048;
const DEFAULT_CONTEXT_WINDOW = 2_048;
const CONTEXT_RESERVE_TOKENS = 256;

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
  const baseUrl = (process.env.LLM_BASE_URL || process.env.VLLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = process.env.LLM_MODEL_NAME || process.env.VLLM_MODEL || DEFAULT_MODEL;
  const apiKey = process.env.LLM_API_KEY || process.env.VLLM_API_KEY || "EMPTY";
  const parsedTimeout = Number(process.env.LLM_TIMEOUT_MS || process.env.VLLM_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(parsedTimeout) ? Math.max(3_000, parsedTimeout) : DEFAULT_TIMEOUT_MS;
  const parsedContextWindow = Number(process.env.LLM_CONTEXT_WINDOW || process.env.VLLM_CONTEXT_WINDOW || DEFAULT_CONTEXT_WINDOW);
  const contextWindow = Number.isFinite(parsedContextWindow) ? Math.max(512, Math.round(parsedContextWindow)) : DEFAULT_CONTEXT_WINDOW;
  const parsedMaxTokens = Number(process.env.LLM_MAX_TOKENS || process.env.VLLM_MAX_TOKENS || DEFAULT_MAX_TOKENS);
  const requestedMaxTokens = Number.isFinite(parsedMaxTokens) ? Math.max(64, Math.round(parsedMaxTokens)) : DEFAULT_MAX_TOKENS;
  const maxByContext = Math.max(64, contextWindow - CONTEXT_RESERVE_TOKENS);
  const maxTokens = Math.min(requestedMaxTokens, maxByContext);
  const useMock = process.env.LETICIA_MOCK === "1";
  return { baseUrl, model, apiKey, timeoutMs, contextWindow, maxTokens, useMock };
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

function ensurePrompt(history: ChatHistoryItem[], prompt: string): ChatHistoryItem[] {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) return history;
  const last = history[history.length - 1];
  if (last?.role === "user" && last.content === trimmedPrompt) return history;
  return [...history, { role: "user", content: trimmedPrompt }];
}

function isShortPrompt(prompt: string) {
  const normalized = prompt.trim();
  if (!normalized) return true;
  const words = normalized.split(/\s+/).filter(Boolean);
  return normalized.length <= 90 && words.length <= 16;
}

type PromptComplexity = "direct" | "short" | "medium" | "complex";

function classifyPromptComplexity(prompt: string): PromptComplexity {
  const normalized = prompt.trim();
  if (!normalized) return "short";

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

  if (complexity === "direct") {
    return {
      temperature: 0.12,
      topP: 0.8,
      maxTokens: Math.min(config.maxTokens, 140),
      repetitionPenalty: 1.12,
      brevityInstruction:
        "Resposta objetiva e pontual: va direto ao ponto em 1 frase curta ou lista curta (quando apropriado), sem explicacao longa.",
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
  return [
    LETICIA_SYSTEM_PROMPT.trim(),
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
  const lines = [LETICIA_SYSTEM_PROMPT.trim()];
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
    throw new LlmRouteError(503, "LLM_UNAVAILABLE", "Motor de IA indisponivel no momento.");
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

  const shouldFallbackToCompletions = (status: number) => [400, 404, 405, 422].includes(status);
  let tokenLimitDetected = false;
  let chatFailure: { status: number; body: string } | null = null;

  for (let index = 0; index < tokenCandidates.length; index += 1) {
    const maxTokens = tokenCandidates[index];
    const isLastCandidate = index === tokenCandidates.length - 1;
    const chatPayload = {
      model: config.model,
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
    if (isTokenLimitFailure(chatResponse.status, body)) {
      tokenLimitDetected = true;
      console.warn("KNEXAI_CHAT_TOKEN_RETRY", {
        status: chatResponse.status,
        maxTokens,
        nextAttempt: !isLastCandidate,
      });
      if (!isLastCandidate) continue;
    }
    if (!shouldFallbackToCompletions(chatResponse.status)) {
      console.error("KNEXAI_CHAT_ERROR", {
        status: chatResponse.status,
        bodySnippet: body.slice(0, 300),
      });
      throw new LlmRouteError(502, "LLM_UPSTREAM_ERROR", "Falha ao consultar o motor de IA.");
    }
    break;
  }

  if (chatFailure) {
    console.warn("KNEXAI_CHAT_FALLBACK", {
      status: chatFailure.status,
      bodySnippet: chatFailure.body.slice(0, 300),
    });
  }

  for (let index = 0; index < tokenCandidates.length; index += 1) {
    const maxTokens = tokenCandidates[index];
    const isLastCandidate = index === tokenCandidates.length - 1;
    const completionPayload = {
      model: config.model,
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
    if (isTokenLimitFailure(completionResponse.status, completionErrorBody)) {
      tokenLimitDetected = true;
      console.warn("KNEXAI_COMPLETION_TOKEN_RETRY", {
        status: completionResponse.status,
        maxTokens,
        nextAttempt: !isLastCandidate,
      });
      if (!isLastCandidate) continue;
    }

    console.error("KNEXAI_COMPLETION_ERROR", {
      status: completionResponse.status,
      bodySnippet: completionErrorBody.slice(0, 300),
    });
    throw new LlmRouteError(502, "LLM_UPSTREAM_ERROR", "Falha ao consultar o motor de IA.");
  }

  if (tokenLimitDetected) {
    throw new LlmRouteError(
      422,
      "LLM_CONTEXT_LIMIT",
      "Contexto muito longo para o modelo atual. Reduza o historico ou ajuste LLM_MAX_TOKENS.",
    );
  }

  throw new LlmRouteError(502, "LLM_UPSTREAM_ERROR", "Falha ao consultar o motor de IA.");
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
  return Response.json(
    {
      ok: true,
      endpoint: "/api/knexai",
      provider: "openai-compatible",
      baseUrl: config.baseUrl,
      model: config.model,
      contextWindow: config.contextWindow,
      maxTokens: config.maxTokens,
      mock: config.useMock,
    },
    { status: 200 },
  );
}

export async function POST(req: NextRequest) {
  const config = readLlmConfig();

  try {
    const { prompt = "", history = [] } = await req.json().catch(() => ({ prompt: "", history: [] }));
    const safePrompt = typeof prompt === "string" ? prompt.trim() : "";
    const safeHistory = ensurePrompt(normalizeHistory(history), safePrompt);

    if (!safeHistory.length) {
      return safeBackendError(400, "EMPTY_INPUT", "Informe um texto para enviar ao modelo.");
    }

    if (config.useMock) {
      return new Response(buildMockStream(safePrompt), {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const upstream = await requestLlmStreaming(config, safeHistory, safePrompt);
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
  } catch (error) {
    if (error instanceof LlmRouteError) {
      console.error("KNEXAI_LLM_ERROR", { code: error.code, status: error.status, message: error.message });
      return safeBackendError(error.status, error.code, error.message);
    }
    console.error("KNEXAI_POST_UNEXPECTED_ERROR", error);
    return safeBackendError(500, "INTERNAL_ERROR", "Erro interno ao processar a requisicao.");
  }
}
