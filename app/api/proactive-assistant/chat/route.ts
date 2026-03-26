import { NextRequest } from "next/server";
import { readConfiguredAnmBaseUrl, resolveReachableAnmBaseUrl } from "@/app/api/_shared/anm-endpoint";
import { rebuildConversationState } from "@/core/chat/perception/conversation-state.manager";
import { enforceResponseStructure } from "@/core/chat/perception/response-structure.enforcer";

export const runtime = "nodejs";

type ChatHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

type AnmChatResult = {
  answer: string;
  traceId: string | null;
};

type PromptComplexity = "micro" | "direct" | "short" | "medium" | "complex";
type SupportedLocale = "pt-BR" | "en-US" | "es-ES";

const DEFAULT_ANM_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_ANM_TIMEOUT_MS = 45_000;

function pickFirstNonEmpty(...values: Array<string | undefined | null>) {
  for (const value of values) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) return trimmed;
  }
  return "";
}

function readAnmConfig() {
  const anmBaseUrl = readConfiguredAnmBaseUrl(pickFirstNonEmpty(process.env.ANM_API_BASE_URL, DEFAULT_ANM_BASE_URL));
  const parsedTimeout = Number(process.env.ANM_API_TIMEOUT_MS || DEFAULT_ANM_TIMEOUT_MS);
  const anmTimeoutMs = Number.isFinite(parsedTimeout) ? Math.max(3_000, Math.round(parsedTimeout)) : DEFAULT_ANM_TIMEOUT_MS;
  return { anmBaseUrl, anmTimeoutMs };
}

function normalizeHistory(value: unknown): ChatHistoryItem[] {
  if (!Array.isArray(value)) return [];
  const normalized: ChatHistoryItem[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const role = (row as { role?: unknown }).role;
    const content = typeof (row as { content?: unknown }).content === "string" ? `${(row as { content?: string }).content}`.trim() : "";
    if ((role === "user" || role === "assistant") && content) {
      normalized.push({ role, content });
    }
  }
  return normalized.slice(-20);
}

function normalizeRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isMicroSocialPrompt(prompt: string): boolean {
  const normalized = prompt.trim();
  if (!normalized) return false;

  const compact = normalized
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[!?.,;:"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = compact.split(" ").filter(Boolean);
  if (words.length > 8 || normalized.length > 60) return false;

  const microSocialPatterns = [
    /^(oi|ola|oie|oii|e ai|eae|opa|hey|hello|hi)$/i,
    /^(bom dia|boa tarde|boa noite)$/i,
    /^(blz|beleza|tudo bem|td bem|como vai|como vc esta|como voce esta|how are you|que tal)$/i,
    /^(nada por agora|nada agora|de boa|tranquilo|ok|okay|ok obrigado|obrigado|obg|valeu)$/i,
    /^(ate logo|ate mais|tchau|falou|ate breve|bye|adios)$/i,
  ];

  return microSocialPatterns.some((pattern) => pattern.test(compact));
}

function resolveMicroSocialLocale(prompt: string): SupportedLocale {
  const lowered = prompt.toLowerCase();
  if (/\b(hello|hi|hey|thanks|thank you|bye)\b/i.test(lowered)) return "en-US";
  if (/\b(hola|gracias|adios)\b/i.test(lowered)) return "es-ES";
  return "pt-BR";
}

function buildMicroSocialAnswer(prompt: string) {
  const compact = prompt
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[!?.,;:"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const locale = resolveMicroSocialLocale(prompt);

  if (/^(como vc esta|como voce esta|como vai|how are you|tudo bem|td bem|que tal)$/.test(compact)) {
    if (locale === "en-US") return "I am doing well and ready to help. What do you want to do next?";
    if (locale === "es-ES") return "Estoy bien y lista para ayudar. Que quieres hacer ahora?";
    return "Estou bem e pronta para ajudar. O que voce quer fazer agora?";
  }

  if (/^(tchau|falou|ate mais|ate logo|bye|adios)$/.test(compact)) {
    if (locale === "en-US") return "See you! If you need anything else, I am here.";
    if (locale === "es-ES") return "Hasta luego. Si necesitas algo mas, aqui estoy.";
    return "Ate mais. Se precisar de algo, estou aqui.";
  }

  if (/^(obrigado|obg|valeu|thanks|thank you|gracias)$/.test(compact)) {
    if (locale === "en-US") return "You are welcome. I am ready for the next step.";
    if (locale === "es-ES") return "De nada. Estoy lista para el siguiente paso.";
    return "De nada. Estou pronta para o proximo passo.";
  }

  if (locale === "en-US") return "Hi. How can I help you right now?";
  if (locale === "es-ES") return "Hola. Como puedo ayudarte ahora?";
  return "Oi. Como posso te ajudar agora?";
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
    /\b(sinonimo|sinonimos|antonimo|antonimos)\b/i,
    /\b(traduz|traduza|traducao|translation)\b/i,
    /\b(defina|definicao|o que significa|significa)\b/i,
    /\b(corrija|correcao|ortografia|gramatica)\b/i,
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
  if (wordCount <= 14 && charCount <= 100) return "short";
  return "medium";
}

async function parseErrorMessage(response: Response) {
  const contentType = `${response.headers.get("content-type") || ""}`.toLowerCase();
  if (contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => null)) as { detail?: unknown; message?: unknown; code?: unknown } | null;
    return `${payload?.message || payload?.detail || payload?.code || ""}`.trim();
  }
  return (await response.text().catch(() => "")).trim().slice(0, 320);
}

function resolveAnmAnswer(payload: unknown): AnmChatResult {
  if (!payload || typeof payload !== "object") {
    throw new Error("ANM retornou payload invalido.");
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
  if (!answer) throw new Error("ANM nao retornou resposta textual.");
  const traceCandidate =
    typeof candidate.trace_id === "string"
      ? candidate.trace_id
      : typeof candidate.traceId === "string"
        ? candidate.traceId
        : "";
  return { answer, traceId: traceCandidate || null };
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

async function requestLeticiaAnmChat(input: {
  anmBaseUrl: string;
  anmTimeoutMs: number;
  prompt: string;
  history: ChatHistoryItem[];
  localeHint: string;
  conversationKey: string;
  userKey: string;
  sharedIdentityRuntime: Record<string, unknown> | null;
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), input.anmTimeoutMs);
  try {
    const response = await fetch(`${input.anmBaseUrl}/assistant/leticia/respond`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        message: input.prompt,
        mode: "proactive",
        locale_hint: input.localeHint || undefined,
        conversation_key: input.conversationKey,
        user_key: input.userKey,
        history: input.history,
        shared_identity_runtime: input.sharedIdentityRuntime || undefined,
      }),
    });

    if (response.status === 404) {
      return { response, fallback: true as const, answer: null as AnmChatResult | null, detail: "" };
    }
    if (!response.ok) {
      const detail = await parseErrorMessage(response);
      return { response, fallback: false as const, answer: null as AnmChatResult | null, detail };
    }
    const payload = await response.json().catch(() => null);
    const answer = resolveAnmAnswer(payload);
    return { response, fallback: false as const, answer, detail: "" };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requestFallbackAnmChat(input: {
  anmBaseUrl: string;
  anmTimeoutMs: number;
  prompt: string;
  sharedIdentityRuntime: Record<string, unknown> | null;
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), input.anmTimeoutMs);
  try {
    const response = await fetch(`${input.anmBaseUrl}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        message: input.prompt,
        shared_identity_runtime: input.sharedIdentityRuntime || undefined,
      }),
    });
    if (!response.ok) {
      const detail = await parseErrorMessage(response);
      return { ok: false as const, detail, status: response.status };
    }
    const payload = await response.json().catch(() => null);
    return { ok: true as const, answer: resolveAnmAnswer(payload) };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(req: NextRequest) {
  let resolvedAnmBaseUrl = "";
  let attemptedAnmBaseUrls: string[] = [];
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const promptRaw = body.prompt ?? body.message;
    const prompt = typeof promptRaw === "string" ? promptRaw.trim() : "";
    if (!prompt) {
      return Response.json(
        {
          ok: false,
          code: "PROACTIVE_PROMPT_REQUIRED",
          message: "Informe prompt (ou message) para conversar com o assistente proativo.",
        },
        { status: 400 },
      );
    }

    const history = normalizeHistory(body.history);
    const localeHint =
      (typeof body.localeHint === "string" && body.localeHint.trim()) ||
      (typeof body.locale === "string" && body.locale.trim()) ||
      "";
    const conversationKey =
      (typeof body.conversationKey === "string" && body.conversationKey.trim()) ||
      (typeof body.conversation_key === "string" && body.conversation_key.trim()) ||
      (typeof body.sessionId === "string" && body.sessionId.trim()) ||
      "leticia:proactive";
    const userKey =
      (typeof body.userKey === "string" && body.userKey.trim()) ||
      (typeof body.user_key === "string" && body.user_key.trim()) ||
      "chat-session";
    if (isMicroSocialPrompt(prompt)) {
      return new Response(createChunkedTextStream(buildMicroSocialAnswer(prompt)), {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
    const sharedIdentityFromBody =
      normalizeRecord(body.sharedIdentityRuntime) || normalizeRecord(body.shared_identity_runtime);
    const sharedIdentityRuntime = sharedIdentityFromBody || null;
    const conversationState = rebuildConversationState({
      conversationKey,
      prompt,
      history,
      localeHint,
    });
    const complexity = classifyPromptComplexity(prompt);
    const { anmBaseUrl, anmTimeoutMs } = readAnmConfig();
    const anmResolution = await resolveReachableAnmBaseUrl({
      configuredBaseUrl: anmBaseUrl,
      timeoutMs: Math.min(2_000, anmTimeoutMs),
      healthPath: "/healthz",
    });
    resolvedAnmBaseUrl = anmResolution.baseUrl;
    attemptedAnmBaseUrls = anmResolution.attemptedBaseUrls;

    const leticiaResult = await requestLeticiaAnmChat({
      anmBaseUrl: resolvedAnmBaseUrl,
      anmTimeoutMs,
      prompt,
      history,
      localeHint,
      conversationKey,
      userKey,
      sharedIdentityRuntime,
    });

    if (!leticiaResult.fallback && leticiaResult.answer) {
      const answer = enforceResponseStructure(leticiaResult.answer.answer, {
        state: conversationState,
        complexity,
      });
      const headers: Record<string, string> = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" };
      if (leticiaResult.answer.traceId) headers["x-knexai-trace-id"] = leticiaResult.answer.traceId;
      return new Response(createChunkedTextStream(answer || leticiaResult.answer.answer), { status: 200, headers });
    }

    if (!leticiaResult.fallback) {
      return Response.json(
        {
          ok: false,
          code: "PROACTIVE_UPSTREAM_ERROR",
          message: leticiaResult.detail || `Falha ao consultar o motor proativo (HTTP ${leticiaResult.response.status}).`,
        },
        { status: leticiaResult.response.status >= 500 ? 502 : leticiaResult.response.status },
      );
    }

    const fallback = await requestFallbackAnmChat({
      anmBaseUrl: resolvedAnmBaseUrl,
      anmTimeoutMs,
      prompt,
      sharedIdentityRuntime,
    });
    if (!fallback.ok) {
      return Response.json(
        {
          ok: false,
          code: "PROACTIVE_UPSTREAM_ERROR",
          message: fallback.detail || `Falha ao consultar o motor proativo (HTTP ${fallback.status}).`,
        },
        { status: fallback.status >= 500 ? 502 : fallback.status },
      );
    }
    const answer = enforceResponseStructure(fallback.answer.answer, {
      state: conversationState,
      complexity,
    });
    const headers: Record<string, string> = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" };
    if (fallback.answer.traceId) headers["x-knexai-trace-id"] = fallback.answer.traceId;
    return new Response(createChunkedTextStream(answer || fallback.answer.answer), { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assistente proativo indisponivel no momento.";
    const attempted = attemptedAnmBaseUrls.length ? attemptedAnmBaseUrls.join(", ") : "n/a";
    const anmEndpoint = resolvedAnmBaseUrl || "n/a";
    return Response.json(
      {
        ok: false,
        code: "PROACTIVE_UNAVAILABLE",
        message: `${message} (ANM: ${anmEndpoint}; tentados: ${attempted})`,
      },
      { status: 503 },
    );
  }
}

