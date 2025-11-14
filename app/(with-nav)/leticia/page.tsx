"use client";

import React, { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* ------------------------------- Tipos ---------------------------------- */
type Role = "user" | "assistant" | "system";
type Msg = { id: string; role: Role; content: string; createdAt: number };
type Thread = { id: string; title: string; createdAt: number; messages: Msg[] };

/* --------------------------- Storage Keys -------------------------------- */
const THREADS_KEY = "LETICIA_THREADS_V1";
const CURR_KEY = "LETICIA_CURRENT_V1";
const DRAFT_KEY = "LETICIA_DRAFT_V1";

/* --------------------- Geração (preferência p/ vLLM) -------------------- */
const DEFAULT_GEN = {
  max_tokens: 900,
  temperature: 0.7,
  top_p: 0.9,
};

/* -------------------------------- Utils --------------------------------- */
function makeSeedThread(): Thread {
  return {
    id: typeof crypto !== "undefined" ? crypto.randomUUID() : "seed",
    title: "Novo chat",
    createdAt: Date.now(),
    messages: [
      {
        id: "sys-hello",
        role: "assistant",
        content: "Olá! Eu sou a **Letícia**. Como posso ajudar hoje?",
        createdAt: Date.now(),
      },
    ],
  };
}
function makeSeedThreadWithId(id: string): Thread {
  return {
    id,
    title: "Novo chat",
    createdAt: Date.now(),
    messages: [
      {
        id: "sys-hello",
        role: "assistant",
        content: "Olá! Eu sou a **Letícia**. Como posso ajudar hoje?",
        createdAt: Date.now(),
      },
    ],
  };
}
function ellipsize(s: string, n: number) {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > n ? t.slice(0, n - 1) + "…" : t || "Novo chat";
}
async function safeText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
function cleanAssistant(text: string) {
  let out = text.replace(/^\s*\[[\s\S]*?\]\s*$/gm, "").trim();
  out = out.replace(/\n{3,}/g, "\n\n");
  return out;
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (a + b).toUpperCase() || "U";
}

/* ---------------------- Textarea (antes do 1º uso) ---------------------- */
const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className = "", ...props }, ref) => (
  <textarea
    ref={ref}
    rows={1}
    className={
      "w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] leading-6 outline-none focus:ring-2 focus:ring-emerald-500/30 " +
      className
    }
    {...props}
  />
));
Textarea.displayName = "Textarea";

/* ------------------------------- Página ---------------------------------- */
export default function LeticiaPage() {
  const [threads, setThreads] = useState<Thread[]>([makeSeedThread()]);
  const [currentId, setCurrentId] = useState<string>("");
  const [input, setInput] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUserMsg, setLastUserMsg] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [userName, setUserName] = useState("Convidado");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  /* -------- Altura dinâmica do Navbar (usa o <nav id="site-nav"> do seu Nav) -------- */
  const [navHeight, setNavHeight] = useState(0);
  useEffect(() => {
    const el =
      (document.getElementById("site-nav") as HTMLElement | null) ||
      (document.querySelector('nav[role="navigation"]') as HTMLElement | null) ||
      (document.querySelector("nav") as HTMLElement | null);

    const measure = () => setNavHeight(el?.offsetHeight ?? 0);
    measure();

    const ro = el ? new ResizeObserver(measure) : null;
    ro?.observe(el!);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  /* --------------------------- Hidratação segura -------------------------- */
  const [hydrated, setHydrated] = useState(false);

  // Carregar do localStorage (sem sobrescrever)
  useEffect(() => {
    // THREADS
    let loadedThreads: Thread[] | null = null;
    try {
      const rawThreads = localStorage.getItem(THREADS_KEY);
      loadedThreads = rawThreads ? (JSON.parse(rawThreads) as Thread[]) : null;
    } catch {}
    if (loadedThreads && loadedThreads.length) {
      setThreads(loadedThreads);
    }

    // CURRENT ID
    try {
      const savedCurr = localStorage.getItem(CURR_KEY);
      if (savedCurr) {
        setCurrentId(savedCurr);
      } else if (loadedThreads && loadedThreads.length) {
        setCurrentId(loadedThreads[0].id);
      } else {
        // mantém o seed inicial já presente no estado
        setCurrentId((prev) => prev || "");
      }
    } catch {}

    // DRAFT
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) setInput(draft);
    } catch {}

    // Supabase (identidade)
    const supabase = createClientComponentClient();
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user;
      if (!u) return;
      const nm =
        (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) ||
        u.email ||
        "Usuário";
      setUserName(String(nm));
      setUserEmail(u.email ?? null);
    });

    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Salvar no localStorage APÓS hidratar
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
    } catch {}
  }, [threads, hydrated]);

  useEffect(() => {
    if (!hydrated || !currentId) return;
    try {
      localStorage.setItem(CURR_KEY, currentId);
    } catch {}
  }, [currentId, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(DRAFT_KEY, input);
    } catch {}
  }, [input, hydrated]);

  /* ----------------------------- UI Helpers ------------------------------ */
  const current = useMemo(
    () => threads.find((t) => t.id === currentId) ?? threads[0],
    [threads, currentId],
  );
  const messages = current?.messages ?? [];
  const hasUserMsg = messages.some((m) => m.role === "user");

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(220, Math.max(56, el.scrollHeight)) + "px";
  }, [input, pending]);

  const canSend = useMemo(() => input.trim().length > 0 && !pending, [input, pending]);

  function newChat() {
    const t = makeSeedThread();
    setThreads((arr) => [t, ...arr]);
    setCurrentId(t.id);
    setInput("");
    setError(null);
  }
  function openChat(id: string) {
    setCurrentId(id);
    setError(null);
  }
  function deleteChat(id: string) {
    setThreads((arr) => {
      const next = arr.filter((t) => t.id !== id);
      if (!next.length) next.push(makeSeedThread());
      if (id === currentId) setCurrentId(next[0].id);
      return next;
    });
  }
  function pushMessages(updater: (msgs: Msg[]) => Msg[]) {
    setThreads((arr) =>
      arr.map((t) => (t.id === current.id ? { ...t, messages: updater(t.messages) } : t)),
    );
  }
  function renameIfEmptyTitle(fromFirstUser: string) {
    setThreads((arr) =>
      arr.map((t) =>
        t.id === current.id && (!t.title || t.title === "Novo chat")
          ? { ...t, title: ellipsize(fromFirstUser, 32) }
          : t,
      ),
    );
  }

  async function sendCore(promptText: string) {
    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: "user",
      content: promptText.trim(),
      createdAt: Date.now(),
    };
    const assistantId = crypto.randomUUID();

    pushMessages((m) => [
      ...m,
      userMsg,
      { id: assistantId, role: "assistant", content: "", createdAt: Date.now() },
    ]);
    renameIfEmptyTitle(promptText);
    setLastUserMsg(promptText);

    setPending(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;

    const enrichedHistory = [
      {
        role: "system",
        content:
          "Você é Letícia, assistente educacional. Seja claro e didático. Quando a pergunta for complexa, responda em pelo menos 6 parágrafos bem estruturados, com coesão e exemplos, mantendo precisão técnica. Use Markdown básico.",
      } as Msg,
      ...messages.map(({ role, content }) => ({ role, content })),
    ];

    try {
      const res = await fetch("/api/leticia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "vllm",
          prompt: promptText,
          history: enrichedHistory,
          gen: DEFAULT_GEN,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await safeText(res);
        throw new Error(text || `HTTP ${res.status}`);
      }

      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          const cleaned = cleanAssistant(acc);
          pushMessages((m) =>
            m.map((msg) => (msg.id === assistantId ? { ...msg, content: cleaned } : msg)),
          );
        }
        acc += new TextDecoder().decode();
        pushMessages((m) =>
          m.map((msg) => (msg.id === assistantId ? { ...msg, content: cleanAssistant(acc) } : msg)),
        );
      } else {
        const text = cleanAssistant(await res.text());
        pushMessages((m) =>
          m.map((msg) => (msg.id === assistantId ? { ...msg, content: text } : msg)),
        );
      }
    } catch (e: any) {
      if (e?.name === "AbortError") {
        pushMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId ? { ...msg, content: "⏹️ geração interrompida" } : msg,
          ),
        );
      } else {
        setError(e?.message ?? "Falha ao contatar o endpoint.");
        pushMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId ? { ...msg, content: "❌ Erro ao gerar resposta." } : msg,
          ),
        );
      }
    } finally {
      setPending(false);
      abortRef.current = null;
      taRef.current?.focus();
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    await sendCore(text);
  }
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  }
  function handleStop() {
    abortRef.current?.abort();
  }
  function handleRegenerate() {
    if (!lastUserMsg || pending) return;
    sendCore(lastUserMsg);
  }

  const [showJump, setShowJump] = useState(false);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setShowJump(!nearBottom);
    };
    onScroll();
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [messages.length]);

  const jumpToBottom = () =>
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });

  /* -------------------------------- UI ----------------------------------- */
  return (
    <div className="fixed inset-0 overflow-hidden bg-slate-50">
      {/* Sidebar FIXA à esquerda — começa logo abaixo do navbar */}
      <aside
        className="fixed left-0 w-72 border-r border-slate-200 bg-white z-10"
        style={{ top: navHeight, height: `calc(100vh - ${navHeight}px)` }}
      >
        <div className="flex h-full flex-col">
          <div className="p-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Histórico</h2>
            <button
              onClick={newChat}
              className="text-xs rounded-md border px-2 py-1 hover:bg-slate-50"
              title="Novo chat"
            >
              Novo chat
            </button>
          </div>

          {/* Rolagem apenas no histórico */}
          <div
            className="flex-1 overflow-y-auto overscroll-contain px-2 py-2 space-y-1"
            style={{ scrollbarGutter: "stable" }}
          >
            {threads.map((t) => {
              const active = t.id === current.id;
              return (
                <div key={t.id} className="group flex items-center gap-2">
                  <button
                    onClick={() => openChat(t.id)}
                    className={[
                      "flex-1 text-left truncate rounded-md px-2 py-1.5 text-[13px]",
                      active ? "bg-emerald-600 text-white" : "hover:bg-slate-100",
                    ].join(" ")}
                    title={t.title}
                  >
                    {t.title || "Novo chat"}
                  </button>
                  <button
                    onClick={() => deleteChat(t.id)}
                    className="invisible group-hover:visible text-slate-400 hover:text-rose-600"
                    title="Excluir"
                  >
                    🗑️
                  </button>
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-slate-200">
            <div className="flex items-center gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-600 text-white text-xs font-bold">
                {initials(userName)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-900">{userName}</div>
                {userEmail && <div className="truncate text-xs text-slate-500">{userEmail}</div>}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Área do chat deslocada para a direita e abaixo do navbar */}
      <section className="h-full ml-72" style={{ paddingTop: navHeight }}>
        <div className="h-full flex flex-col">
          <header className="shrink-0 px-4 md:px-6 py-3 border-b border-slate-200 bg-white">
            <div className="mx-auto max-w-4xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-grid h-8 w-8 place-items-center rounded bg-emerald-600 text-white">
                  L
                </span>
                <h1 className="text-lg font-semibold">Letícia</h1>
                <span className="text-slate-400 text-sm">/ Chat</span>
              </div>
              <button
                onClick={() =>
                  setThreads((arr) =>
                    arr.map((t) => (t.id === current.id ? makeSeedThreadWithId(t.id) : t)),
                  )
                }
                className="text-xs rounded-md border px-2 py-1 hover:bg-slate-50"
                title="Limpar conversa atual"
              >
                Limpar
              </button>
            </div>
          </header>

          {/* Lista + Composer */}
          <div className="relative flex-1 min-h-0">
            <div className="mx-auto h-full w-full max-w-4xl px-4 md:px-6 flex flex-col">
              {/* Lista de mensagens com rolagem própria (topo reto; arredondado só embaixo) */}
              <div
                ref={listRef}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain
                           rounded-b-2xl rounded-t-none border border-t-0 border-slate-200
                           bg-white shadow-sm px-4 md:px-6 py-6 space-y-6"
                style={{ scrollbarGutter: "stable", borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
              >
                {messages.map((m) => (
                  <MessageItem key={m.id} msg={m} />
                ))}
                {pending && <Typing />}
                {error && <p className="text-sm text-rose-600">Erro: {error}</p>}
              </div>

              {/* Botão “ir para o fim” */}
              {showJump && (
                <button
                  onClick={jumpToBottom}
                  className="absolute left-1/2 -translate-x-1/2 bottom-36 z-10 rounded-full border bg-white shadow px-3 py-2 text-sm hover:bg-slate-50"
                  title="Ir para o fim"
                >
                  ↓ Ir para o fim
                </button>
              )}

              {/* Composer */}
              <div className="shrink-0 mt-3 rounded-2xl border border-slate-200 bg-white shadow-sm p-4 md:p-5">
                <div className="flex flex-col gap-2">
                  <div className="flex items-end gap-2">
                    <Textarea
                      ref={taRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Envie uma mensagem…"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!canSend}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-white font-medium hover:bg-emerald-500 disabled:opacity-50"
                    >
                      <SendIcon />
                      Enviar
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <p>Enter para enviar • Shift+Enter nova linha • Cmd/Ctrl+Enter enviar</p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleStop}
                        disabled={!pending}
                        className="rounded border px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Parar
                      </button>
                      <button
                        onClick={handleRegenerate}
                        disabled={pending || !lastUserMsg}
                        className="rounded border px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Reenviar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-2 text-center text-[12px] text-slate-400">
                Respostas podem conter erros. Não compartilhe informações sensíveis.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* --------------------------- Componentes UI ------------------------------ */

function MessageItem({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex gap-3 max-w-[90%]`}>
        {!isUser && (
          <div className="mt-1 h-8 w-8 shrink-0 rounded bg-emerald-600 text-white grid place-items-center">
            L
          </div>
        )}
        <div
          className={[
            "rounded-2xl px-4 py-3 text-[15px] leading-6 whitespace-pre-wrap max-h-[60vh] overflow-y-auto overscroll-contain",
            isUser
              ? "bg-emerald-600 text-white rounded-br-md"
              : "bg-slate-50 text-slate-900 rounded-bl-md border border-slate-200",
          ].join(" ")}
          style={{ scrollbarGutter: "stable" }}
        >
          <MarkdownLite text={msg.content || (isUser ? "" : "…")} />
          {!isUser && msg.content && <MsgActions text={msg.content} />}
        </div>
      </div>
    </div>
  );
}

function MsgActions({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }
  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
      <button onClick={copy} className="rounded border px-2 py-1 hover:bg-slate-100">
        {copied ? "Copiado" : "Copiar"}
      </button>
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

function SendIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

/* --------------------------- Markdown “lite” ----------------------------- */
function MarkdownLite({ text }: { text: string }) {
  const withBlocks = text.replace(/```([\s\S]*?)```/g, (_, code: string) => {
    return `<pre class="codeblock"><code>${escapeHtml(code)}</code></pre>`;
  });
  const withInline = withBlocks.replace(/`([^`]+?)`/g, (_, code: string) => {
    return `<code class="inlinecode">${escapeHtml(code)}</code>`;
  });
  const withEm = withInline
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  const withLinks = withEm.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    `<a href="$2" target="_blank" rel="noreferrer" class="link">$1</a>`,
  );

  return (
    <div
      className="prose prose-slate max-w-none text-[15px] leading-6"
      dangerouslySetInnerHTML={{ __html: withLinks }}
    />
  );
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
