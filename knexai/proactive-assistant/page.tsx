"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, Radio, SendHorizontal, Sparkles } from "lucide-react";

type ChatRole = "user" | "assistant" | "system";

type AssistantMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  source?: "user" | "proactive" | "event";
};

type PresencePayload = {
  status?: string;
  someone_in_frame?: boolean;
  identity_confirmed?: boolean;
  awareness_state?: Record<string, unknown>;
  current_identity?: Record<string, unknown> | null;
  at?: string;
};

type SendOptions = {
  hiddenUser?: boolean;
  source?: "user" | "proactive";
};

const PROACTIVE_COOLDOWN_MS = 45_000;

function makeMessageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function extractIdentityLabel(payload: PresencePayload) {
  const identity = payload.current_identity;
  if (!identity || typeof identity !== "object") return "visitante";
  const nominalName = typeof identity.nominal_name === "string" ? identity.nominal_name.trim() : "";
  if (nominalName) return nominalName;
  const label = typeof identity.label === "string" ? identity.label.trim() : "";
  if (label) return label;
  return "visitante";
}

async function parseErrorMessage(response: Response) {
  const contentType = `${response.headers.get("content-type") || ""}`.toLowerCase();
  if (contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: unknown; detail?: unknown; code?: unknown }
      | null;
    const msg =
      (typeof payload?.message === "string" && payload.message.trim()) ||
      (typeof payload?.detail === "string" && payload.detail.trim()) ||
      "";
    if (msg) return msg;
    const code = typeof payload?.code === "string" ? payload.code.trim() : "";
    if (code) return code;
    return "";
  }
  return (await response.text().catch(() => "")).trim();
}

function buildHistoryForApi(messages: AssistantMessage[]) {
  return messages
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content,
    }))
    .slice(-16);
}

export default function ProactiveAssistantPage() {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: makeMessageId(),
      role: "assistant",
      source: "proactive",
      content:
        "Assistente proativo iniciado. Continuarei em modo conversacional e, se houver evento de camera autorizado, vou agir de forma proativa.",
      createdAt: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState("");
  const [streamStatus, setStreamStatus] = useState("Conectando...");
  const [proactiveEnabled, setProactiveEnabled] = useState(true);
  const [showCameraPane, setShowCameraPane] = useState(true);
  const [presenceState, setPresenceState] = useState<PresencePayload | null>(null);

  const messagesRef = useRef(messages);
  const statusRef = useRef(status);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastProactiveAtRef = useRef(0);

  useEffect(() => {
    messagesRef.current = messages;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const upsertAssistantMessage = useCallback((assistantId: string, nextContent: string) => {
    setMessages((prev) =>
      prev.map((row) => (row.id === assistantId ? { ...row, content: nextContent } : row)),
    );
  }, []);

  const sendPrompt = useCallback(
    async (rawPrompt: string, options: SendOptions = {}) => {
      const prompt = rawPrompt.trim();
      if (!prompt || statusRef.current === "sending") return;

      const nextSource = options.source || "user";
      const currentHistory = buildHistoryForApi(messagesRef.current);
      const assistantId = makeMessageId();

      if (options.hiddenUser) {
        setMessages((prev) => [
          ...prev,
          {
            id: makeMessageId(),
            role: "system",
            source: "event",
            content: "Evento proativo autorizado recebido. Gerando resposta em tempo real.",
            createdAt: Date.now(),
          },
          {
            id: assistantId,
            role: "assistant",
            source: nextSource,
            content: "",
            createdAt: Date.now(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: makeMessageId(),
            role: "user",
            source: "user",
            content: prompt,
            createdAt: Date.now(),
          },
          {
            id: assistantId,
            role: "assistant",
            source: nextSource,
            content: "",
            createdAt: Date.now(),
          },
        ]);
      }

      setStatus("sending");
      setError("");
      try {
        const response = await fetch("/api/proactive-assistant/chat", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({
            prompt,
            history: currentHistory,
          }),
        });
        if (!response.ok) {
          const detail = await parseErrorMessage(response);
          throw new Error(detail || `CHAT_HTTP_${response.status}`);
        }
        if (!response.body) {
          const fallback = (await response.text().catch(() => "")).trim();
          upsertAssistantMessage(assistantId, fallback || "Sem conteudo retornado.");
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;
          accumulated += chunk;
          upsertAssistantMessage(assistantId, accumulated);
        }
        const tail = decoder.decode();
        if (tail) {
          accumulated += tail;
          upsertAssistantMessage(assistantId, accumulated);
        }
        if (!accumulated.trim()) {
          upsertAssistantMessage(assistantId, "Resposta vazia recebida.");
        }
      } catch (sendError) {
        const detail = sendError instanceof Error ? sendError.message : "Falha ao gerar resposta.";
        upsertAssistantMessage(assistantId, `Erro: ${detail}`);
        setError(detail);
      } finally {
        setStatus("idle");
      }
    },
    [upsertAssistantMessage],
  );

  const triggerProactiveReply = useCallback(
    (payload: PresencePayload) => {
      if (!proactiveEnabled) return;
      if (!payload.someone_in_frame) return;
      if (statusRef.current !== "idle") return;

      const now = Date.now();
      if (now - lastProactiveAtRef.current < PROACTIVE_COOLDOWN_MS) return;
      lastProactiveAtRef.current = now;

      const identityLabel = extractIdentityLabel(payload);
      const proactivePrompt = [
        "Contexto de streaming em tempo real autorizado:",
        `- Presenca detectada: sim`,
        `- Identidade confirmada: ${payload.identity_confirmed ? "sim" : "nao"}`,
        `- Rotulo observado: ${identityLabel}`,
        "",
        "Gere uma mensagem curta, natural e proativa para abrir conversa com o usuario agora.",
        "Responda em pt-BR, sem mencionar regras internas.",
      ].join("\n");

      void sendPrompt(proactivePrompt, { hiddenUser: true, source: "proactive" });
    },
    [proactiveEnabled, sendPrompt],
  );

  useEffect(() => {
    const eventSource = new EventSource("/api/proactive-assistant/events");

    const parsePayload = (event: Event) => {
      const messageEvent = event as MessageEvent;
      try {
        return JSON.parse(`${messageEvent.data || "{}"}`) as PresencePayload;
      } catch {
        return null;
      }
    };

    const onReady = () => setStreamStatus("Conectado");
    const onError = () => setStreamStatus("Desconectado");
    const onState = (event: Event) => {
      const payload = parsePayload(event);
      if (!payload) return;
      setPresenceState(payload);
    };
    const onPresenceChanged = (event: Event) => {
      const payload = parsePayload(event);
      if (!payload) return;
      setPresenceState(payload);
      triggerProactiveReply(payload);
    };

    eventSource.addEventListener("ready", onReady);
    eventSource.addEventListener("state", onState);
    eventSource.addEventListener("presence_changed", onPresenceChanged);
    eventSource.addEventListener("error", onError);

    return () => {
      eventSource.removeEventListener("ready", onReady);
      eventSource.removeEventListener("state", onState);
      eventSource.removeEventListener("presence_changed", onPresenceChanged);
      eventSource.removeEventListener("error", onError);
      eventSource.close();
    };
  }, [triggerProactiveReply]);

  const canSend = useMemo(() => status === "idle" && input.trim().length > 0, [input, status]);
  const someoneInFrame = Boolean(presenceState?.someone_in_frame);
  const identityLabel = extractIdentityLabel(presenceState || {});
  const runQuickAction = useCallback(
    (prompt: string) => {
      void sendPrompt(prompt, { hiddenUser: true, source: "proactive" });
    },
    [sendPrompt],
  );

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen w-full flex-col md:flex-row">
        <aside className="w-full shrink-0 border border-slate-200 bg-white p-4 md:w-[320px] lg:w-[360px]">
          <div className="flex flex-col gap-3">
            <Link
              href="/knexai/web"
              className="inline-flex items-center gap-2 border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Chat Base
            </Link>
            <div className="inline-flex items-center gap-2 bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
              <Sparkles className="h-4 w-4" />
              Assistente Virtual Proativo (Produto 4)
            </div>
            <button
              type="button"
              onClick={() => setProactiveEnabled((current) => !current)}
              className={`px-3 py-2 text-sm font-medium ${
                proactiveEnabled ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              {proactiveEnabled ? "Proatividade: ON" : "Proatividade: OFF"}
            </button>
            <button
              type="button"
              onClick={() => setShowCameraPane((current) => !current)}
              className={`px-3 py-2 text-sm font-medium ${
                showCameraPane ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              {showCameraPane ? "Camera no topo: ON" : "Camera no topo: OFF"}
            </button>
            <div className="space-y-2 border-t border-slate-200 pt-3 text-sm text-slate-600">
              <p className="inline-flex items-center gap-2">
                <Radio className="h-4 w-4" />
                Stream: {streamStatus}
              </p>
              <p className="inline-flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Presenca em quadro: {someoneInFrame ? "sim" : "nao"}
              </p>
              <p>Identidade atual: {someoneInFrame ? identityLabel : "-"}</p>
            </div>
          </div>
        </aside>

        <section className="flex min-h-[72vh] min-w-0 flex-1 flex-col border border-slate-200 bg-white md:h-screen">
          {showCameraPane ? (
            <section className="border-b border-slate-200 bg-slate-50 py-3">
              <div className="mx-auto w-full max-w-[640px] border border-slate-700 bg-black">
                <header className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100">
                  <span className="inline-flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Streaming de camera
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCameraPane(false)}
                    className="border border-slate-500 px-2 py-1 text-[11px] font-medium hover:bg-slate-800"
                  >
                    Ocultar
                  </button>
                </header>
                <iframe
                  title="Streaming de camera para identificacao"
                  src="/knexai/identity-runtime?embedded=1&view=stream"
                  className="h-[240px] w-full border-0 bg-black md:h-[300px]"
                  allow="camera; microphone; autoplay; clipboard-read; clipboard-write"
                />
              </div>
            </section>
          ) : (
            <section className="border-b border-slate-200 bg-slate-50 px-3 py-2">
              <button
                type="button"
                onClick={() => setShowCameraPane(true)}
                className="border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Mostrar streaming de camera
              </button>
            </section>
          )}

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`max-w-[90%] px-4 py-3 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "ml-auto bg-slate-900 text-white"
                    : message.role === "assistant"
                      ? "bg-slate-100 text-slate-900"
                      : "border border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">
                  {message.role === "user" ? "usuario" : message.role === "assistant" ? "assistente" : "evento"}
                </p>
                <p className="whitespace-pre-wrap">{message.content || "..."}</p>
              </article>
            ))}
            <div ref={bottomRef} />
          </div>

          <footer className="mt-auto border-t border-slate-200 p-3">
            {error ? <p className="mb-2 text-xs text-rose-600">{error}</p> : null}
            <section className="mb-2 border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  Voz da IA
                </span>
                <span>{status === "sending" ? "emitindo" : "em espera"}</span>
              </div>
              <div className="mt-2 flex h-8 items-end gap-1">
                {[10, 18, 14, 22, 12, 20, 15, 11].map((barHeight, index) => (
                  <span
                    key={`voice-bar-${index}`}
                    className={`w-1 bg-slate-700 ${status === "sending" ? "animate-pulse" : ""}`}
                    style={{
                      height: status === "sending" ? `${barHeight}px` : "6px",
                      animationDelay: `${index * 90}ms`,
                    }}
                  />
                ))}
              </div>
            </section>
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={2}
                placeholder="Converse com o assistente proativo..."
                className="max-h-40 min-h-[52px] flex-1 resize-y border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
              <button
                type="button"
                disabled={!canSend}
                onClick={() => {
                  const value = input.trim();
                  if (!value) return;
                  setInput("");
                  void sendPrompt(value, { source: "user" });
                }}
                className={`inline-flex h-[44px] items-center gap-2 px-4 text-sm font-medium ${
                  canSend ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-slate-200 text-slate-500"
                }`}
              >
                <SendHorizontal className="h-4 w-4" />
                {status === "sending" ? "Gerando..." : "Enviar"}
              </button>
            </div>
          </footer>
        </section>

        <aside className="w-full shrink-0 border border-slate-200 bg-white p-4 md:w-[280px] lg:w-[320px]">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">Funcoes Rapidas</h2>
            <button
              type="button"
              onClick={() =>
                runQuickAction(
                  "Faça uma saudação proativa curta para o usuário considerando o contexto visual atual.",
                )
              }
              className="w-full border border-slate-300 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              Saudação proativa
            </button>
            <button
              type="button"
              onClick={() =>
                runQuickAction(
                  "Faça uma pergunta curta para entender como você pode ajudar agora, sem ser genérico.",
                )
              }
              className="w-full border border-slate-300 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              Pergunta de apoio
            </button>
            <button
              type="button"
              onClick={() =>
                runQuickAction(
                  "Resuma em uma frase o estado de presença e identidade para orientar a conversa proativa.",
                )
              }
              className="w-full border border-slate-300 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              Resumo visual
            </button>
            <div className="border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <p>Status stream: {streamStatus}</p>
              <p>Alguem em quadro: {someoneInFrame ? "sim" : "nao"}</p>
              <p>Identidade: {someoneInFrame ? identityLabel : "-"}</p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
