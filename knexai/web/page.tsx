"use client";

import { useEffect, useRef, useState } from "react";
import { LETICIA_SYSTEM_PROMPT } from "@/lib/knexai/spec";
import { streamLeticia, type LeticiaMessage } from "../lib/client";

const QUICK_PROMPTS = [
  "Resuma um PDF de aula em 5 topicos claros.",
  "Gere um roteiro de estudo para a semana com base nas aulas novas.",
  "Explique o conceito central deste artigo para um aluno iniciante.",
  "Liste 3 perguntas de revisao para a prova de sexta.",
];

const initialMessages: LeticiaMessage[] = [
  {
    role: "assistant",
    content: "Oi! Eu sou a L.E.T.I.C.I.A., IA do ecossistema KnexIT. Envie um prompt ou escolha um atalho para comecar.",
  },
];

export default function KnexAiPage() {
  const [messages, setMessages] = useState<LeticiaMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "thinking" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || status === "thinking") return;

    const userMsg: LeticiaMessage = { role: "user", content: trimmed };
    const history = [...messages, userMsg];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setStatus("thinking");
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamLeticia(trimmed, history, {
        signal: controller.signal,
        onChunk: (delta) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              last.content += delta;
            }
            return next;
          });
        },
        onDone: () => setStatus("idle"),
      });
    } catch (err: any) {
      setStatus("error");
      setError(err?.message ?? "Erro ao falar com a Leticia");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-8">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600">Produto</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-bold">KnexAI</h1>
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
              Mistral + Leticia
            </span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                /api/knexai
              </span>
          </div>
          <p className="text-base text-slate-700 max-w-3xl">
            Ambiente dedicado de IA nativa. Envie prompts com contexto, receba streaming e integre com os demais produtos do
            ecossistema (Drive, Read, Review, Search).
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Chat com a Leticia</p>
                <p className="text-xs text-slate-500">Streaming habilitado; usa historico da conversa.</p>
              </div>
              <div className="text-xs">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${
                    status === "thinking" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-current" />
                  {status === "thinking" ? "Gerando" : "Pronto"}
                </span>
              </div>
            </div>

            <div className="h-[520px] overflow-y-auto px-4 py-4 space-y-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    m.role === "assistant"
                      ? "bg-indigo-50 text-slate-900"
                      : "ml-auto bg-slate-900 text-white"
                  }`}
                >
                  {m.content || <span className="text-slate-400">Digitando...</span>}
                </div>
              ))}
              <div ref={endRef} />
            </div>

            <div className="border-t border-slate-100 px-4 py-3 space-y-2">
              {error && <p className="text-sm text-rose-600">Falha: {error}</p>}
              <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <textarea
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
                  rows={3}
                  placeholder="Escreva seu prompt ou cole um contexto..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                />
                <button
                  className="h-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                  onClick={() => send(input)}
                  disabled={!input.trim() || status === "thinking"}
                >
                  Enviar
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:border-indigo-200 hover:text-indigo-700"
                    onClick={() => send(p)}
                    disabled={status === "thinking"}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
              <p className="text-sm font-semibold text-slate-900">Motor e modelo</p>
              <p className="text-sm text-slate-700">
                Endpoint: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/api/knexai</code>
              </p>
              <p className="text-xs text-slate-500">
                Em desenvolvimento, LETICIA_MOCK=1 usa respostas simuladas. Para usar modelo local, configure o servidor
                vLLM com um modelo compatível (por exemplo o GGUF do Mistral) e as variáveis VLLM_* adequadas.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
              <p className="text-sm font-semibold text-slate-900">Contexto base</p>
              <pre className="max-h-40 overflow-y-auto rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-700">
                {LETICIA_SYSTEM_PROMPT}
              </pre>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
              <p className="text-sm font-semibold text-slate-900">Como integrar</p>
              <ul className="list-disc space-y-1 pl-4 text-sm text-slate-700">
                <li>Consuma este chat direto do /knexai.</li>
                <li>Reutilize o helper em <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">knexai/lib/client.ts</code> para streaming.</li>
                <li>Conecte as fontes (Drive, Review, Search) enviando contexto no prompt.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
