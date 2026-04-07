import { NextRequest } from "next/server";
import {
  buildSharedIdentityRuntimePayload,
  readIdentityRuntimeStatus,
  resolveRequestOrigin,
} from "@/app/api/proactive-assistant/_shared";
import {
  readConfiguredAiSystemAnmBaseUrl,
  resolveReachableAiSystemAnmBaseUrl,
} from "@/app/api/_shared/ai-system-anm-endpoint";
import { rebuildConversationState } from "@/core/chat/perception/conversation-state.manager";
import { enforceResponseStructure } from "@/core/chat/perception/response-structure.enforcer";

export const runtime = "nodejs";

type ChatHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

type PromptComplexity = "micro" | "direct" | "short" | "medium" | "complex";
type SupportedLocale = "pt-BR" | "en-US" | "es-ES";

function pickFirstNonEmpty(...values: Array<string | undefined | null>) {
  for (const value of values) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) return trimmed;
  }
  return "";
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
    /^(oi|ola|oie|oii|e ai|eae|opa|saudacoes|hey|hello|hi)$/i,
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

  if (/^saudacoes$/.test(compact)) {
    if (locale === "en-US") return "Greetings. How can I help you right now?";
    if (locale === "es-ES") return "Saludos. Como puedo ayudarte ahora?";
    return "Saudações. Como posso te ajudar agora?";
  }

  if (/^(?:(?:oi|ola|opa|fala|salve|saudacoes)\s+)?(como vc esta|como voce esta|como vai|how are you|tudo bem|td bem|que tal)$/.test(compact)) {
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
  if (contentType.includes("text/html")) {
    const html = (await response.text().catch(() => "")).trim();
    const compact = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (response.status === 404 || /\b404\b/.test(compact)) {
      return "Rota nao encontrada no backend canonico (HTTP 404).";
    }
    return compact.slice(0, 220);
  }
  return (await response.text().catch(() => "")).trim().slice(0, 320);
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

function stripConversationRoleArtifacts(text: string): string {
  return text
    .replace(/(^|\n)\s*(assistant|leticia|let[ií]cia)\s*[:\-]\s*/gim, "$1")
    .replace(/(^|\n)\s*(usuario|user)\s*[:\-]\s*/gim, "$1")
    .replace(/^\s*resposta\s*:\s*/im, "")
    .trim();
}

function readCanonicalChatTimeoutMs() {
  const parsed = Number(
    pickFirstNonEmpty(
      process.env.AI_SYSTEM_PROACTIVE_CHAT_TIMEOUT_MS,
      process.env.AI_SYSTEM_ANM_API_TIMEOUT_MS,
      "45000",
    ),
  );
  if (!Number.isFinite(parsed)) return 45_000;
  return Math.max(3_000, Math.round(parsed));
}

async function requestLeticiaCanonicalChat(input: {
  baseUrl: string;
  timeoutMs: number;
  prompt: string;
  history: ChatHistoryItem[];
  localeHint: string;
  conversationKey: string;
  userKey: string;
  sharedIdentityRuntime: Record<string, unknown> | null;
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    return await fetch(`${input.baseUrl}/api/ai-system-anm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        prompt: input.prompt,
        history: input.history,
        localeHint: input.localeHint || undefined,
        locale: input.localeHint || undefined,
        conversationKey: input.conversationKey,
        userKey: input.userKey,
        sharedIdentityRuntime: input.sharedIdentityRuntime || undefined,
        // Proactive sempre exige fluxo descendente + geração com vLLM.
        forceDescendingPipeline: true,
        descendingPipelineEnabled: true,
        descendingPipelineStrict: true,
        directFallbackEnabled: false,
        disableMicroSocialFastPath: true,
        disableIdentityCanonicalFallback: true,
        requireGenerationLlm: true,
        stream: false,
      }),
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(req: NextRequest) {
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
    const origin = resolveRequestOrigin(req);
    if (isMicroSocialPrompt(prompt)) {
      return new Response(createChunkedTextStream(buildMicroSocialAnswer(prompt)), {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
    const configuredAiSystemBaseUrl = readConfiguredAiSystemAnmBaseUrl();
    const aiSystemBaseResolution = await resolveReachableAiSystemAnmBaseUrl({
      configuredBaseUrl: configuredAiSystemBaseUrl,
      timeoutMs: Math.min(2_000, readCanonicalChatTimeoutMs()),
      healthPath: "/healthz",
    });
    const aiSystemBaseUrl = aiSystemBaseResolution.baseUrl;

    const sharedIdentityFromBody =
      normalizeRecord(body.sharedIdentityRuntime) || normalizeRecord(body.shared_identity_runtime);
    const identityRuntimeSnapshot = await readIdentityRuntimeStatus(origin, 2_000);
    const sharedIdentityRuntime =
      sharedIdentityFromBody || buildSharedIdentityRuntimePayload(identityRuntimeSnapshot) || null;
    const conversationState = rebuildConversationState({
      conversationKey,
      prompt,
      history,
      localeHint,
    });
    const complexity = classifyPromptComplexity(prompt);
    let upstream = await requestLeticiaCanonicalChat({
      baseUrl: aiSystemBaseUrl,
      timeoutMs: readCanonicalChatTimeoutMs(),
      prompt,
      history,
      localeHint,
      conversationKey,
      userKey,
      sharedIdentityRuntime,
    });

    if (!upstream.ok) {
      let detail = await parseErrorMessage(upstream);
      if (sharedIdentityRuntime && upstream.status >= 500) {
        const retryWithoutIdentity = await requestLeticiaCanonicalChat({
          baseUrl: aiSystemBaseUrl,
          timeoutMs: readCanonicalChatTimeoutMs(),
          prompt,
          history,
          localeHint,
          conversationKey,
          userKey,
          sharedIdentityRuntime: null,
        });
        if (retryWithoutIdentity.ok) {
          upstream = retryWithoutIdentity;
        } else {
          detail = await parseErrorMessage(retryWithoutIdentity);
        }
      }
      if (!upstream.ok) {
      return Response.json(
        {
          ok: false,
          code: "PROACTIVE_LETICIA_UPSTREAM_ERROR",
          message: detail || `Falha ao consultar a API da Letícia (HTTP ${upstream.status}).`,
        },
        { status: upstream.status >= 500 ? 502 : upstream.status },
      );
      }
    }

    const upstreamPipeline = `${upstream.headers.get("x-knexai-pipeline") || ""}`.trim().toLowerCase();
    if (upstreamPipeline !== "descending") {
      return Response.json(
        {
          ok: false,
          code: "PROACTIVE_PIPELINE_WATCHDOG",
          message:
            "Watchdog canônico ativo: resposta recusada porque não veio do pipeline descendente do ai-system-anm.",
        },
        { status: 503 },
      );
    }

    const llmUsed = `${upstream.headers.get("x-knexai-generation-llm-used") || ""}`.trim();
    if (llmUsed !== "1") {
      return Response.json(
        {
          ok: false,
          code: "PROACTIVE_VLLM_REQUIRED",
          message:
            "Resposta recusada: o fluxo proativo exige participação ativa do vLLM no pipeline da Letícia.",
        },
        { status: 503 },
      );
    }

    const rawAnswer = (await upstream.text().catch(() => "")).trim();
    if (!rawAnswer) {
      return Response.json(
        {
          ok: false,
          code: "PROACTIVE_EMPTY_RESPONSE",
          message: "A API da Letícia retornou resposta vazia para este turno proativo.",
        },
        { status: 502 },
      );
    }

    const canonicalAnswer = stripConversationRoleArtifacts(rawAnswer);
    const answer = upstreamPipeline === "descending"
      ? canonicalAnswer || rawAnswer
      : enforceResponseStructure(canonicalAnswer || rawAnswer, {
          state: conversationState,
          complexity,
        });
    const headers: Record<string, string> = {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-knexai-pipeline": upstreamPipeline || "descending",
      "x-knexai-route": `${upstream.headers.get("x-knexai-route") || ""}`,
      "x-knexai-generation-llm-used": llmUsed,
      "x-knexai-generation-llm-provider": `${upstream.headers.get("x-knexai-generation-llm-provider") || ""}`,
      "x-knexai-generation-llm-model": `${upstream.headers.get("x-knexai-generation-llm-model") || ""}`,
      "x-knexai-watchdog": `${upstream.headers.get("x-knexai-watchdog") || "canonical-descending-enforced"}`,
    };
    const traceId = `${upstream.headers.get("x-knexai-trace-id") || ""}`.trim();
    if (traceId) headers["x-knexai-trace-id"] = traceId;
    return new Response(createChunkedTextStream(answer || rawAnswer), { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assistente proativo indisponivel no momento.";
    return Response.json(
      {
        ok: false,
        code: "PROACTIVE_UNAVAILABLE",
        message,
      },
      { status: 503 },
    );
  }
}


