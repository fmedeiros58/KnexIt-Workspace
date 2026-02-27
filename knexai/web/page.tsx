"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  Bot,
  CircleEllipsis,
  Code2,
  Compass,
  Image as ImageIcon,
  LayoutGrid,
  MessageSquarePlus,
  Mic,
  MoreHorizontal,
  Search,
  Upload,
} from "lucide-react";
import {
  createPersistedThread,
  loadPersistedThreads,
  savePersistedMessage,
  streamLeticia,
  type LeticiaMessage,
  type PersistedThread,
} from "../lib/client";

type ChatThread = {
  id: string;
  storageId: string | null;
  title: string;
  updatedAt: number;
  messages: LeticiaMessage[];
};

type CachedThread = {
  id: string;
  storageId: string | null;
  title: string;
  updatedAt: number;
  messages: LeticiaMessage[];
};

const SESSION_STORAGE_KEY = "knexai_session_id";
const THREAD_CACHE_PREFIX = "knexai_threads_cache_v1";

const initialMessages: LeticiaMessage[] = [
  {
    role: "assistant",
    content: "Oi! Eu sou a L.E.T.I.C.I.A. Pergunte o que voce precisar.",
  },
];

const SIDEBAR_ACTIONS = [
  { id: "new", label: "Novo chat", icon: MessageSquarePlus },
  { id: "search", label: "Buscar em chats", icon: Search },
  { id: "images", label: "Imagens", icon: ImageIcon },
  { id: "apps", label: "Aplicativos", icon: LayoutGrid },
  { id: "research", label: "Investigacao", icon: Compass },
  { id: "code", label: "Codex", icon: Code2 },
];

function makeThreadId() {
  return `thread-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function makeThreadTitle(prompt: string) {
  const base = prompt.trim().replace(/\s+/g, " ");
  if (!base) return "Novo chat";
  if (base.length <= 42) return base;
  return `${base.slice(0, 42)}...`;
}

function toModelHistory(messages: LeticiaMessage[]): LeticiaMessage[] {
  return messages.filter((message, index) => {
    if (index === 0 && message.role === "assistant" && message.content === initialMessages[0]?.content) {
      return false;
    }
    return message.role === "user" || message.role === "assistant";
  });
}

function resolveClientSessionId() {
  try {
    const fromStorage = window.localStorage.getItem(SESSION_STORAGE_KEY)?.trim();
    if (fromStorage) return fromStorage;
    const generated = `knx-${crypto.randomUUID()}`;
    window.localStorage.setItem(SESSION_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `knx-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }
}

function toLocalThread(thread: PersistedThread): ChatThread {
  const messages =
    thread.messages.length > 0
      ? thread.messages
          .filter((message) => message.role === "user" || message.role === "assistant")
          .map((message) => ({ role: message.role as "user" | "assistant", content: message.content }))
      : initialMessages;
  return {
    id: thread.id,
    storageId: thread.id,
    title: thread.title || "Novo chat",
    updatedAt: Date.parse(thread.updatedAt) || Date.now(),
    messages,
  };
}

function sanitizeCachedThreads(raw: string | null): ChatThread[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CachedThread[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((thread) => {
        const safeMessages = Array.isArray(thread.messages)
          ? thread.messages.filter(
              (message) =>
                message &&
                (message.role === "user" || message.role === "assistant") &&
                typeof message.content === "string" &&
                message.content.trim(),
            )
          : [];
        return {
          id: typeof thread.id === "string" && thread.id ? thread.id : makeThreadId(),
          storageId: typeof thread.storageId === "string" && thread.storageId ? thread.storageId : null,
          title: typeof thread.title === "string" && thread.title.trim() ? thread.title.trim() : "Novo chat",
          updatedAt: Number.isFinite(thread.updatedAt) ? thread.updatedAt : Date.now(),
          messages: safeMessages.length ? safeMessages : initialMessages,
        };
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

type ComposerProps = {
  docked: boolean;
  input: string;
  status: "idle" | "thinking" | "error";
  onInputChange: (value: string) => void;
  onSend: () => void;
};

function Composer({ docked, input, status, onInputChange, onSend }: ComposerProps) {
  return (
    <div className={`w-full rounded-[28px] border border-zinc-300 bg-white shadow-sm ${docked ? "" : "max-w-3xl"}`}>
      <textarea
        className="h-16 w-full resize-none rounded-t-[28px] border-0 px-6 pt-5 text-[21px] text-zinc-900 outline-none placeholder:text-zinc-500"
        placeholder="Pergunte alguma coisa"
        value={input}
        onChange={(event) => {
          onInputChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
      />

      <div className="flex items-center justify-between px-4 pb-3">
        <div className="flex items-center gap-2">
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100">
            <span className="text-2xl leading-none">+</span>
          </button>
          <button
            type="button"
            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            Pensamento estendido
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100">
            <Mic size={17} />
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={!input.trim() || status === "thinking"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KnexAiPage() {
  const initialThread: ChatThread = useMemo(
    () => ({
      id: "thread-inicial",
      storageId: null,
      title: "Novo chat",
      updatedAt: Date.now(),
      messages: initialMessages,
    }),
    [],
  );

  const [threads, setThreads] = useState<ChatThread[]>([initialThread]);
  const [activeThreadId, setActiveThreadId] = useState(initialThread.id);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "thinking" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isChatMode, setIsChatMode] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [composerReservePx, setComposerReservePx] = useState(180);

  const endRef = useRef<HTMLDivElement | null>(null);
  const composerDockRef = useRef<HTMLDivElement | null>(null);
  const lastAssistantBubbleRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamIdRef = useRef(0);
  const threadStoreLocksRef = useRef<Record<string, Promise<string | null>>>({});
  const pendingDeltaRef = useRef("");
  const flushFrameRef = useRef<number | null>(null);

  const activeThread = useMemo(() => threads.find((item) => item.id === activeThreadId) ?? threads[0], [activeThreadId, threads]);
  const activeMessages = activeThread?.messages ?? initialMessages;
  const hasUserMessages = activeMessages.some((msg) => msg.role === "user");
  const showChat = isChatMode || hasUserMessages || status === "thinking";

  useEffect(() => {
    if (!showChat) return;
    endRef.current?.scrollIntoView({
      behavior: status === "thinking" ? "auto" : "smooth",
      block: "end",
      inline: "nearest",
    });
  }, [activeMessages, showChat, status, composerReservePx]);

  useEffect(() => {
    const bubble = lastAssistantBubbleRef.current;
    if (!bubble) return;
    if (status === "thinking" || bubble.scrollHeight > bubble.clientHeight) {
      bubble.scrollTop = bubble.scrollHeight;
    }
  }, [activeMessages, status]);

  useEffect(() => {
    if (!showChat) return;
    const dock = composerDockRef.current;
    if (!dock) return;

    const updateReserve = () => {
      const height = Math.ceil(dock.getBoundingClientRect().height);
      setComposerReservePx(Math.max(120, height + 16));
    };

    updateReserve();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateReserve) : null;
    observer?.observe(dock);
    window.addEventListener("resize", updateReserve);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateReserve);
    };
  }, [showChat]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSessionId(resolveClientSessionId());
  }, []);

  useEffect(() => {
    if (!sessionId || typeof window === "undefined") return;
    const cacheKey = `${THREAD_CACHE_PREFIX}:${sessionId}`;
    let cachedThreads: ChatThread[] = [];
    try {
      cachedThreads = sanitizeCachedThreads(window.localStorage.getItem(cacheKey));
    } catch {
      cachedThreads = [];
    }
    if (cachedThreads.length) {
      setThreads(cachedThreads);
      setActiveThreadId((current) => (cachedThreads.some((thread) => thread.id === current) ? current : cachedThreads[0].id));
    }

    let cancelled = false;
    const hydrate = async () => {
      try {
        const persisted = await loadPersistedThreads(sessionId);
        if (cancelled || !persisted.length) return;
        const mapped = persisted.map(toLocalThread).sort((a, b) => b.updatedAt - a.updatedAt);
        setThreads(mapped);
        setActiveThreadId((current) => (mapped.some((thread) => thread.id === current) ? current : mapped[0].id));
      } catch (hydrateError) {
        console.warn("KNEXAI_THREADS_HYDRATE_WARN", hydrateError);
      }
    };
    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || typeof window === "undefined") return;
    const cacheKey = `${THREAD_CACHE_PREFIX}:${sessionId}`;
    const cachePayload: CachedThread[] = threads.map((thread) => ({
      id: thread.id,
      storageId: thread.storageId,
      title: thread.title,
      updatedAt: thread.updatedAt,
      messages: thread.messages,
    }));
    try {
      window.localStorage.setItem(cacheKey, JSON.stringify(cachePayload));
    } catch {
      // noop: cache local eh mecanismo complementar ao banco.
    }
  }, [sessionId, threads]);

  const ensureThreadStored = async (thread: ChatThread, nextTitle: string): Promise<string | null> => {
    if (thread.storageId) return thread.storageId;
    if (!sessionId) return null;
    const existingLock = threadStoreLocksRef.current[thread.id];
    if (existingLock) return existingLock;

    const lock = (async () => {
      try {
        const created = await createPersistedThread(sessionId, nextTitle);
        setThreads((prev) =>
          prev.map((item) =>
            item.id === thread.id
              ? {
                  ...item,
                  storageId: created.id,
                  title: created.title || item.title,
                  updatedAt: Date.now(),
                }
              : item,
          ),
        );
        return created.id;
      } catch (storeError) {
        console.warn("KNEXAI_THREAD_STORE_WARN", storeError);
        return null;
      } finally {
        delete threadStoreLocksRef.current[thread.id];
      }
    })();
    threadStoreLocksRef.current[thread.id] = lock;
    return lock;
  };

  const persistMessage = async (threadId: string | null, role: "user" | "assistant", content: string) => {
    if (!sessionId || !threadId || !content.trim()) return;
    try {
      await savePersistedMessage({ sessionId, threadId, role, content });
    } catch (persistError) {
      console.warn("KNEXAI_MESSAGE_PERSIST_WARN", persistError);
    }
  };

  const createNewChat = () => {
    abortRef.current?.abort();
    if (flushFrameRef.current !== null) {
      window.cancelAnimationFrame(flushFrameRef.current);
      flushFrameRef.current = null;
    }
    pendingDeltaRef.current = "";
    streamIdRef.current += 1;
    const nextThread: ChatThread = {
      id: makeThreadId(),
      storageId: null,
      title: "Novo chat",
      updatedAt: Date.now(),
      messages: initialMessages,
    };
    setThreads((prev) => [nextThread, ...prev]);
    setActiveThreadId(nextThread.id);
    setInput("");
    setError(null);
    setStatus("idle");
    setIsChatMode(false);
  };

  const openThread = (threadId: string) => {
    if (status === "thinking") return;
    const target = threads.find((thread) => thread.id === threadId);
    if (!target) return;
    if (flushFrameRef.current !== null) {
      window.cancelAnimationFrame(flushFrameRef.current);
      flushFrameRef.current = null;
    }
    pendingDeltaRef.current = "";
    setActiveThreadId(threadId);
    setInput("");
    setError(null);
    setIsChatMode(target.messages.some((msg) => msg.role === "user"));
  };

  const send = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || status === "thinking" || !activeThread) return;

    setIsChatMode(true);
    const nextTitle = activeThread.title === "Novo chat" ? makeThreadTitle(trimmed) : activeThread.title;
    const userMsg: LeticiaMessage = { role: "user", content: trimmed };
    const historyForUi = [...activeThread.messages, userMsg];
    const historyForModel = [...toModelHistory(activeThread.messages), userMsg];

    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.id !== activeThread.id) return thread;
        return {
          ...thread,
          title: nextTitle,
          updatedAt: Date.now(),
          messages: [...historyForUi, { role: "assistant", content: "" }],
        };
      }),
    );

    setInput("");
    setStatus("thinking");
    setError(null);

    abortRef.current?.abort();
    if (flushFrameRef.current !== null) {
      window.cancelAnimationFrame(flushFrameRef.current);
      flushFrameRef.current = null;
    }
    pendingDeltaRef.current = "";
    const controller = new AbortController();
    abortRef.current = controller;
    const streamId = streamIdRef.current + 1;
    streamIdRef.current = streamId;
    const targetThreadId = activeThread.id;

    const flushPendingDelta = () => {
      if (streamIdRef.current !== streamId) return;
      const delta = pendingDeltaRef.current;
      if (!delta) return;
      pendingDeltaRef.current = "";
      setThreads((prev) =>
        prev.map((thread) => {
          if (thread.id !== targetThreadId) return thread;
          const lastIndex = thread.messages.length - 1;
          const last = thread.messages[lastIndex];
          const nextMessages =
            last && last.role === "assistant"
              ? [...thread.messages.slice(0, lastIndex), { ...last, content: `${last.content}${delta}` }]
              : thread.messages;
          return {
            ...thread,
            updatedAt: Date.now(),
            messages: nextMessages,
          };
        }),
      );
    };

    const scheduleFlush = () => {
      if (flushFrameRef.current !== null) return;
      flushFrameRef.current = window.requestAnimationFrame(() => {
        flushFrameRef.current = null;
        flushPendingDelta();
        if (pendingDeltaRef.current) scheduleFlush();
      });
    };

    let storedThreadId = activeThread.storageId;
    if (!storedThreadId) {
      storedThreadId = await ensureThreadStored({ ...activeThread, title: nextTitle }, nextTitle);
    }
    void persistMessage(storedThreadId, "user", trimmed);

    let assistantResponse = "";
    try {
      await streamLeticia(trimmed, historyForModel, {
        signal: controller.signal,
        onChunk: (delta) => {
          if (streamIdRef.current !== streamId) return;
          assistantResponse += delta;
          pendingDeltaRef.current += delta;
          scheduleFlush();
        },
        onDone: () => {
          if (streamIdRef.current !== streamId) return;
          if (flushFrameRef.current !== null) {
            window.cancelAnimationFrame(flushFrameRef.current);
            flushFrameRef.current = null;
          }
          flushPendingDelta();
          setStatus("idle");
        },
      });
      await persistMessage(storedThreadId, "assistant", assistantResponse);
    } catch (err: any) {
      if (streamIdRef.current !== streamId) return;
      if (flushFrameRef.current !== null) {
        window.cancelAnimationFrame(flushFrameRef.current);
        flushFrameRef.current = null;
      }
      flushPendingDelta();
      setStatus("error");
      setError(err?.message ?? "Erro ao falar com a Leticia");
    }
  };

  return (
    <main className="flex h-screen min-h-screen bg-[#f7f7f8] text-zinc-900">
      <aside className="hidden h-full w-[300px] flex-col border-r border-zinc-200 bg-[#f0f0f1] lg:flex">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 bg-white">
            <Bot size={17} />
          </div>
          <button type="button" className="rounded-lg p-1 text-zinc-600 hover:bg-zinc-200">
            <CircleEllipsis size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-3 pb-3">
          <div className="space-y-1">
            {SIDEBAR_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={action.id === "new" ? createNewChat : undefined}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[22px] text-zinc-800 hover:bg-zinc-200"
                >
                  <Icon size={20} />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <p className="px-3 text-xs uppercase tracking-[0.14em] text-zinc-500">GPTs</p>
            <div className="mt-2 space-y-1">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => openThread(thread.id)}
                  className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-[21px] ${
                    activeThread?.id === thread.id ? "bg-zinc-200 text-zinc-900" : "text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  <span className="mt-0.5 text-zinc-500">◻</span>
                  <span className="line-clamp-2">{thread.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-auto border-t border-zinc-200 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
              EU
            </span>
            <div>
              <p className="text-sm font-medium text-zinc-900">Usuario KnexIT</p>
              <p className="text-xs text-zinc-500">Plano Plus</p>
            </div>
          </div>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-medium sm:text-[34px]">
              L.E.T.I.C.I.A. <span className="font-normal text-zinc-500">KnexAI</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 text-zinc-700">
            <button type="button" className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-zinc-200">
              <Upload size={16} />
              <span className="hidden sm:inline">Compartilhar</span>
            </button>
            <button type="button" className="rounded-lg p-2 hover:bg-zinc-200">
              <MoreHorizontal size={18} />
            </button>
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col">
          {!showChat ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
              <p className="mb-7 text-center text-5xl font-normal text-zinc-900">O que tem na agenda de hoje?</p>
              <Composer docked={false} input={input} status={status} onInputChange={setInput} onSend={() => void send(input)} />
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]" style={{ scrollPaddingBottom: `${composerReservePx}px` }}>
                <div className="mx-auto w-full max-w-4xl px-6 pt-5 pb-6">
                  {activeMessages.map((message, index) => (
                    <div
                      key={`${activeThread?.id ?? "thread"}-${index}`}
                      className={`mb-4 flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {(() => {
                        const isLastAssistant = message.role === "assistant" && index === activeMessages.length - 1;
                        return (
                      <div
                        ref={isLastAssistant ? lastAssistantBubbleRef : null}
                        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[22px] leading-relaxed ${
                          message.role === "user"
                            ? "bg-zinc-900 text-white"
                            : "max-h-[52vh] overflow-y-auto pr-2 bg-white text-zinc-900 shadow-sm"
                        }`}
                      >
                        {message.content || (
                          <span className="text-zinc-400">
                            {message.role === "assistant" ? "Pensando para te responder melhor..." : "Digitando..."}
                          </span>
                        )}
                      </div>
                        );
                      })()}
                    </div>
                  ))}

                  {error ? (
                    <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Falha: {error}</div>
                  ) : null}

                  <div ref={endRef} style={{ height: `${composerReservePx}px` }} />
                </div>
              </div>

              <div ref={composerDockRef} className="absolute inset-x-0 bottom-0 bg-transparent px-6 py-4">
                <div className="mx-auto w-full max-w-4xl">
                  <Composer docked input={input} status={status} onInputChange={setInput} onSend={() => void send(input)} />
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
