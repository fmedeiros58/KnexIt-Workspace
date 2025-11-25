// app/(with-nav)/leticia/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Role = "user" | "assistant" | "system";

type Msg = {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
};

const STORAGE_KEY = "leticia-thread-v1";
const DRAFT_KEY = "leticia-draft-v1";

export default function LeticiaPage() {
  // Start with client-default state and hydrate from localStorage on mount
  const [messages, setMessages] = useState<Msg[]>(() => seed());
  const [input, setInput] = useState<string>("");

  // Hydrate from localStorage after mount (avoid using localStorage on server)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw) as Msg[]);
    } catch {
      /* ignore */
    }
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) setInput(draft);
    } catch {
      /* ignore */
    }
  }, []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Salva histórico e rascunho
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, input);
  }, [input]);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const canSend = useMemo(() => input.trim().length > 0 && !pending, [input, pending]);

  async function handleSend() {
    if (!canSend) return;
    setError(null);
    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      createdAt: Date.now(),
    };
    setInput("");
    setMessages((m) => [...m, userMsg]);

    // “Mensagem vazia” do assistant para streaming
    const assistantId = crypto.randomUUID();
    setMessages((m) => [
      ...m,
      { id: assistantId, role: "assistant", content: "", createdAt: Date.now() },
    ]);

    setPending(true);
    try {
      const res = await fetch("/api/knexai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userMsg.content, history: toHistory(messages) }),
      });

      if (!res.ok) {
        const text = await safeText(res);
        throw new Error(text || `HTTP ${res.status}`);
      }

      // tenta streaming
      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          // atualiza a última msg (assistant)
          setMessages((m) =>
            m.map((msg) => (msg.id === assistantId ? { ...msg, content: acc } : msg)),
          );
        }
        // flush final
        acc += new TextDecoder().decode();
        setMessages((m) =>
          m.map((msg) => (msg.id === assistantId ? { ...msg, content: acc } : msg)),
        );
      } else {
        // fallback JSON { reply: string }
        const data = (await res.json()) as { reply?: string; message?: string };
        const reply = data.reply ?? data.message ?? "";
        setMessages((m) =>
          m.map((msg) => (msg.id === assistantId ? { ...msg, content: reply } : msg)),
        );
      }
    } catch (e: any) {
      setError(e?.message ?? "Falha ao contatar o endpoint.");
      // marca a última como erro
      setMessages((m) =>
        m.map((msg) =>
          msg.id === assistantId ? { ...msg, content: "❌ Erro ao gerar resposta." } : msg,
        ),
      );
    } finally {
      setPending(false);
      taRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function clearThread() {
    setMessages(seed());
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 md:px-6 py-6 md:py-8">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
            {/* robozinho */}
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <rect x="3" y="7" width="18" height="12" rx="3" />
              <circle cx="9" cy="13" r="1.5" />
              <circle cx="15" cy="13" r="1.5" />
              <path d="M12 7V4M7 4h10" />
            </svg>
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              L.E.T.I.C.I.A. <span className="text-slate-400 font-semibold">/ Assistente</span>
            </h1>
            <p className="text-slate-500 text-sm">
              Faça uma pergunta e aguarde a resposta.{" "}
              <Link href="/api/knexai" className="underline decoration-dotted">
                Endpoint
              </Link>{" "}
              ativo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={clearThread}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            title="Limpar conversa"
          >
            Limpar
          </button>
        </div>
      </header>

      {/* Chat */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Lista de mensagens */}
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto px-4 md:px-6 py-6 space-y-4"
          style={{ scrollbarGutter: "stable" }}
        >
          {messages.map((m) => (
            <Bubble key={m.id} role={m.role} content={m.content} />
          ))}
          {pending && <Typing />}
        </div>

        {/* Separador */}
        <div className="h-px bg-slate-200" />

        {/* Composer */}
        <div className="p-4 md:p-5">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <textarea
                ref={taRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Pergunte algo para a Letícia… (Enter para enviar, Shift+Enter para nova linha)"
                className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] leading-6 outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              {error && <p className="mt-1 text-sm text-rose-600">Erro: {error}</p>}
            </div>
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-white font-medium hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600"
              title="Enviar"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M22 2L11 13" />
                <path d="M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
              Enviar
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Dica: use{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5">Shift</code>+<code className="rounded bg-slate-100 px-1.5 py-0.5">Enter</code>{" "}
            para quebrar linha. Seu rascunho e histórico ficam salvos localmente.
          </p>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- UI ---------------------------------- */

function Bubble({ role, content }: { role: Role; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[15px] leading-6",
          isUser
            ? "bg-indigo-600 text-white rounded-br-md"
            : "bg-slate-100 text-slate-900 rounded-bl-md",
        ].join(" ")}
      >
        {content || (isUser ? "" : "…")}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex items-center gap-2 text-slate-500">
      <span className="inline-flex h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
      <span className="inline-flex h-2 w-2 animate-bounce rounded-full bg-slate-400" />
      <span className="inline-flex h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0.2s]" />
      <span className="text-sm">Aguarde…</span>
    </div>
  );
}

/* --------------------------------- Utils -------------------------------- */

function seed(): Msg[] {
  return [
    {
      id: "sys-hello",
      role: "assistant",
      content:
        "Olá! Eu sou a **Letícia**, sua assistente educacional. Como posso ajudar hoje?",
      createdAt: Date.now(),
    },
  ];
}

function toHistory(msgs: Msg[]) {
  // Formato simples para seu endpoint decidir como usar
  return msgs.map(({ role, content }) => ({ role, content }));
}

async function safeText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
