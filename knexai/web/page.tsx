"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  ArrowUp,
  Bold,
  Bot,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleEllipsis,
  Code2,
  Compass,
  Copy,
  FilePenLine,
  Heading1,
  Image as ImageIcon,
  Italic,
  LayoutGrid,
  List,
  ListOrdered,
  MessageSquarePlus,
  Mic,
  Minus,
  MoreHorizontal,
  PanelRightClose,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Save,
  ScanSearch,
  Search,
  Underline,
  Upload,
  X,
} from "lucide-react";
import {
  continueWrite,
  createWriteProject,
  createWriteSection,
  createPersistedThread,
  getWriteProject,
  getWriteProjectGlobalSummary,
  getWriteSectionSummary,
  listWriteProjectSections,
  listWriteProjects,
  loadPersistedThreads,
  savePersistedMessage,
  streamLeticia,
  type LeticiaMessage,
  type PersistedThread,
  type WriteChunkView,
  type WriteProjectGlobalSummaryView,
  type WriteProjectListItem,
  type WriteSectionSummaryView,
  type WriteSectionView,
} from "../lib/client";

type ChatThread = {
  id: string;
  storageId: string | null;
  title: string;
  updatedAt: number;
  messages: LeticiaMessage[];
  documentScopeIds: number[];
};

type CachedThread = {
  id: string;
  storageId: string | null;
  title: string;
  updatedAt: number;
  messages: LeticiaMessage[];
  documentScopeIds: number[];
};

type AssistantRenderMode = "plain" | "rich";
type AssistantRenderData = {
  mode: AssistantRenderMode;
  content: string;
};
type IngestSingleResult = {
  documentId: number;
  sourcePath: string;
  title: string | null;
  embeddingStatus: "completed" | "failed" | "pending";
};
type IngestSingleResponse = {
  ok: boolean;
  message?: string;
  result?: IngestSingleResult;
};
type WritingWork = {
  documentId: number;
  sourcePath: string;
  title: string;
  embeddingStatus: "completed" | "failed" | "pending";
  createdAt: string;
  updatedAt: string;
};
type WritingFormatCommand = "bold" | "italic" | "underline" | "insertUnorderedList" | "insertOrderedList" | "formatBlock";
type WritingPageFormat = "a4";
type WorkspaceMode = "chat" | "write";
type WriteEditorSessionState = {
  editorSessionId: string;
  activeProjectId: string | null;
  activeSectionId: string | null;
  activeMode: WorkspaceMode;
  loadedSections: WriteSectionView[];
  loadedChunks: WriteChunkView[];
  projectSummary: WriteProjectGlobalSummaryView | null;
  sectionSummary: WriteSectionSummaryView | null;
  currentInstruction: string;
  isSaving: boolean;
  isGenerating: boolean;
  hasUnsavedChanges: boolean;
  lastSyncedAt: string | null;
  saveError: string | null;
};

const SESSION_STORAGE_KEY = "knexai_session_id";
const THREAD_CACHE_PREFIX = "knexai_threads_cache_v1";
const WRITING_NAV_MIN_WIDTH_PERCENT = 16;
const WRITING_NAV_MAX_WIDTH_PERCENT = 44;
const WRITING_NAV_DEFAULT_WIDTH_PERCENT = 24;
const WRITING_WORKS_MIN_WIDTH_PERCENT = 16;
const WRITING_WORKS_MAX_WIDTH_PERCENT = 42;
const WRITING_WORKS_DEFAULT_WIDTH_PERCENT = 22;
const WRITING_PAGE_FORMAT_PRESETS: Record<
  WritingPageFormat,
  {
    widthPx: number;
    heightPx: number;
    gapPx: number;
    contentPaddingXPx: number;
    contentPaddingTopPx: number;
    contentPaddingBottomPx: number;
    bottomClearancePx: number;
  }
> = {
  a4: {
    widthPx: 794,
    heightPx: 1123,
    gapPx: 42,
    contentPaddingXPx: 72,
    contentPaddingTopPx: 72,
    contentPaddingBottomPx: 64,
    bottomClearancePx: 92,
  },
};
const WRITING_DEFAULT_PAGE_FORMAT: WritingPageFormat = "a4";

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeWorkTitle(sourcePath: string, fallbackId: number) {
  const normalizedPath = sourcePath.replace(/\\/g, "/");
  const filename = normalizedPath.split("/").pop()?.trim();
  if (filename) return filename;
  return `Documento ${fallbackId}`;
}

function normalizeDocumentScopeIds(value: unknown, maxItems = 24) {
  if (!Array.isArray(value)) return [];
  const normalized: number[] = [];
  const seen = new Set<number>();
  for (const raw of value) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) continue;
    const item = Math.round(parsed);
    if (item <= 0 || seen.has(item)) continue;
    seen.add(item);
    normalized.push(item);
    if (normalized.length >= maxItems) break;
  }
  return normalized;
}

function mergeDocumentScopeIds(current: number[], incoming: number[], maxItems = 24) {
  return normalizeDocumentScopeIds([...current, ...incoming], maxItems);
}

function resolveDefaultDocumentScopeIds(works: WritingWork[], limit = 8) {
  if (!Array.isArray(works) || !works.length) return [];
  const sorted = [...works].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const completed = sorted.filter((item) => item.embeddingStatus === "completed");
  const fallback = sorted.filter((item) => item.embeddingStatus !== "completed");
  return normalizeDocumentScopeIds(
    [...completed.map((item) => item.documentId), ...fallback.map((item) => item.documentId)].slice(0, limit),
    limit,
  );
}

function formatWorkDate(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "-";
  return new Date(parsed).toLocaleString("pt-BR");
}

function createEditorSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `editor-${crypto.randomUUID()}`;
  }
  return `editor-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderChunkTextAsHtml(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";
  return normalized
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replaceAll("\n", "<br/>")}</p>`)
    .join("");
}

function composeSectionHtml(section: WriteSectionView | null) {
  if (!section) return "<p></p>";
  if (section.chunks.length) {
    const html = section.chunks.map((chunk) => renderChunkTextAsHtml(chunk.text)).filter(Boolean).join("");
    if (html) return html;
  }
  if (section.content.trim()) {
    const fallback = renderChunkTextAsHtml(section.content);
    if (fallback) return fallback;
  }
  return "<p></p>";
}

function resolveEmbeddingStatusMeta(status: WritingWork["embeddingStatus"]) {
  if (status === "completed") {
    return { label: "Indexado", className: "border-emerald-300 bg-emerald-50 text-emerald-700" };
  }
  if (status === "failed") {
    return { label: "Falhou", className: "border-rose-300 bg-rose-50 text-rose-700" };
  }
  return { label: "Pendente", className: "border-amber-300 bg-amber-50 text-amber-700" };
}

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

function resolveAssistantRenderData(content: string): AssistantRenderData {
  const value = content.trim();
  const fencedMatch = value.match(/^```([a-zA-Z0-9_-]*)\s*\n([\s\S]*?)\n```$/);
  if (!fencedMatch) {
    return { mode: "rich", content };
  }
  const language = fencedMatch[1]?.trim().toLowerCase();
  const plainLanguages = new Set(["", "plain", "plaintext", "text", "txt"]);
  if (plainLanguages.has(language)) {
    return { mode: "plain", content: fencedMatch[2] ?? "" };
  }
  return { mode: "rich", content };
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

async function parseJsonResponse<T>(response: Response): Promise<T | null> {
  const bodyText = await response.text();
  if (!bodyText) return null;
  try {
    return JSON.parse(bodyText) as T;
  } catch {
    return null;
  }
}

function toLocalThread(thread: PersistedThread): ChatThread {
  const documentScopeFromMessages = normalizeDocumentScopeIds(
    thread.messages.flatMap((message) => {
      if (!message || typeof message !== "object") return [];
      const metadata = (message as { metadata?: unknown }).metadata;
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
      return Array.isArray((metadata as { rag_document_ids?: unknown }).rag_document_ids)
        ? ((metadata as { rag_document_ids: unknown[] }).rag_document_ids ?? [])
        : [];
    }),
  );
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
    documentScopeIds: documentScopeFromMessages,
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
          documentScopeIds: normalizeDocumentScopeIds((thread as { documentScopeIds?: unknown }).documentScopeIds),
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
  isUploadingFiles: boolean;
  uploadNotice: string | null;
  uploadError: string | null;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onPickFiles: () => void;
  onFilesSelected: (files: File[]) => void;
};

function Composer({
  docked,
  input,
  status,
  isUploadingFiles,
  uploadNotice,
  uploadError,
  onInputChange,
  onSend,
  onPickFiles,
  onFilesSelected,
}: ComposerProps) {
  return (
    <div className={`w-full rounded-[28px] border border-zinc-300 bg-white shadow-sm ${docked ? "" : "max-w-3xl"}`}>
      <textarea
        className="h-16 w-full resize-none rounded-t-[28px] border-0 px-6 pt-5 text-[21px] text-zinc-900 outline-none placeholder:text-zinc-500"
        placeholder={isUploadingFiles ? "Enviando arquivo para ingestao..." : "Pergunte alguma coisa"}
        value={input}
        onChange={(event) => {
          onInputChange(event.target.value);
        }}
        onPaste={(event) => {
          const files = Array.from(event.clipboardData?.items ?? [])
            .map((item) => (item.kind === "file" ? item.getAsFile() : null))
            .filter((file): file is File => !!file);
          if (!files.length) return;
          event.preventDefault();
          onFilesSelected(files);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          const files = Array.from(event.dataTransfer?.files ?? []);
          if (!files.length) return;
          event.preventDefault();
          onFilesSelected(files);
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
          <button
            type="button"
            onClick={onPickFiles}
            disabled={isUploadingFiles}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
            title="Adicionar arquivo"
          >
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
      {uploadNotice ? <p className="px-4 pb-1 text-xs text-emerald-700">{uploadNotice}</p> : null}
      {uploadError ? <p className="px-4 pb-2 text-xs text-rose-600">{uploadError}</p> : null}
      {!uploadNotice && !uploadError ? (
        <p className="px-4 pb-2 text-xs text-zinc-500">Cole, solte ou use + para enviar arquivos para ingestao RAG.</p>
      ) : null}
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
      documentScopeIds: [],
    }),
    [],
  );

  const [threads, setThreads] = useState<ChatThread[]>([initialThread]);
  const [activeThreadId, setActiveThreadId] = useState(initialThread.id);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "thinking" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isChatMode, setIsChatMode] = useState(false);
  const [activeMode, setActiveMode] = useState<WorkspaceMode>("chat");
  const [sessionId, setSessionId] = useState("");
  const [composerReservePx, setComposerReservePx] = useState(180);
  const [writeProjects, setWriteProjects] = useState<WriteProjectListItem[]>([]);
  const [writeSession, setWriteSession] = useState<WriteEditorSessionState>(() => ({
    editorSessionId: createEditorSessionId(),
    activeProjectId: null,
    activeSectionId: null,
    activeMode: "chat",
    loadedSections: [],
    loadedChunks: [],
    projectSummary: null,
    sectionSummary: null,
    currentInstruction: "",
    isSaving: false,
    isGenerating: false,
    hasUnsavedChanges: false,
    lastSyncedAt: null,
    saveError: null,
  }));
  const [writingPrompt, setWritingPrompt] = useState("");
  const [writingStatus, setWritingStatus] = useState<"idle" | "thinking" | "error">("idle");
  const [writingError, setWritingError] = useState<string | null>(null);
  const [writingNotice, setWritingNotice] = useState<string | null>(null);
  const [writingTitle, setWritingTitle] = useState("Documento sem titulo");
  const [isWritingNavCollapsed, setIsWritingNavCollapsed] = useState(false);
  const [writingNavWidthPercent, setWritingNavWidthPercent] = useState(WRITING_NAV_DEFAULT_WIDTH_PERCENT);
  const [writingNavTab, setWritingNavTab] = useState<"titles" | "pages" | "results">("titles");
  const [writingNavQuery, setWritingNavQuery] = useState("");
  const [isWritingWorksCollapsed, setIsWritingWorksCollapsed] = useState(false);
  const [writingWorksWidthPercent, setWritingWorksWidthPercent] = useState(WRITING_WORKS_DEFAULT_WIDTH_PERCENT);
  const [writingWorksQuery, setWritingWorksQuery] = useState("");
  const [writingWorks, setWritingWorks] = useState<WritingWork[]>([]);
  const [writingPageCount, setWritingPageCount] = useState(1);
  const [writingActivePage, setWritingActivePage] = useState(1);
  const [writingPageBreakOffsets, setWritingPageBreakOffsets] = useState<number[]>([]);
  const [writingPageFillRatios, setWritingPageFillRatios] = useState<number[]>([1]);
  const [writingDraftHtml, setWritingDraftHtml] = useState(
    "<h1>Projeto de Escrita</h1><p>Comece aqui seu texto longo. Use a barra superior para formatar e o assistente abaixo para expandir ideias.</p>",
  );
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const writingPageFormat = WRITING_DEFAULT_PAGE_FORMAT;
  const writingPagePreset = WRITING_PAGE_FORMAT_PRESETS[writingPageFormat];
  const writingPageWidthPx = writingPagePreset.widthPx;
  const writingPageHeightPx = writingPagePreset.heightPx;
  const writingPageGapPx = writingPagePreset.gapPx;
  const writingPageStridePx = writingPageHeightPx + writingPageGapPx;
  const writingPagePaddingXPx = writingPagePreset.contentPaddingXPx;
  const writingPagePaddingTopPx = writingPagePreset.contentPaddingTopPx;
  const writingPagePaddingBottomPx = writingPagePreset.contentPaddingBottomPx;
  const writingBottomClearancePx = writingPagePreset.bottomClearancePx;
  const isWritingModeOpen = activeMode === "write";

  const endRef = useRef<HTMLDivElement | null>(null);
  const composerDockRef = useRef<HTMLDivElement | null>(null);
  const lastAssistantBubbleRef = useRef<HTMLDivElement | null>(null);
  const writingEditorRef = useRef<HTMLDivElement | null>(null);
  const writingScrollRef = useRef<HTMLDivElement | null>(null);
  const writingPageRootRef = useRef<HTMLDivElement | null>(null);
  const writingPanelWasOpenRef = useRef(false);
  const writingWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const writingNavResizeRef = useRef<{ startX: number; startWidthPercent: number } | null>(null);
  const writingWorksResizeRef = useRef<{ startX: number; startWidthPercent: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamIdRef = useRef(0);
  const threadStoreLocksRef = useRef<Record<string, Promise<string | null>>>({});
  const pendingDeltaRef = useRef("");
  const flushFrameRef = useRef<number | null>(null);

  const activeThread = useMemo(() => threads.find((item) => item.id === activeThreadId) ?? threads[0], [activeThreadId, threads]);
  const activeMessages = activeThread?.messages ?? initialMessages;
  const activeThreadDocumentScopeIds = useMemo(() => {
    const explicit = normalizeDocumentScopeIds(activeThread?.documentScopeIds ?? []);
    if (explicit.length) return explicit;
    return resolveDefaultDocumentScopeIds(writingWorks);
  }, [activeThread?.documentScopeIds, writingWorks]);
  const activeThreadDocumentWorks = useMemo(() => {
    if (!activeThreadDocumentScopeIds.length || !writingWorks.length) return [] as WritingWork[];
    const worksById = new Map<number, WritingWork>(writingWorks.map((item) => [item.documentId, item]));
    return activeThreadDocumentScopeIds.map((docId) => worksById.get(docId)).filter((item): item is WritingWork => Boolean(item));
  }, [activeThreadDocumentScopeIds, writingWorks]);
  const assistantRenderData = useMemo(
    () => activeMessages.map((message) => (message.role === "assistant" ? resolveAssistantRenderData(message.content) : null)),
    [activeMessages],
  );
  const hasStructuredAssistantResponse = assistantRenderData.some((data) => data?.mode === "rich");
  const hasUserMessages = activeMessages.some((msg) => msg.role === "user");
  const showChat = isChatMode || hasUserMessages || status === "thinking";
  const writingHeadings = useMemo(() => {
    if (typeof window === "undefined") return [] as Array<{ level: number; text: string }>;
    if (!writingDraftHtml.trim()) return [] as Array<{ level: number; text: string }>;
    try {
      const parser = new DOMParser();
      const document = parser.parseFromString(writingDraftHtml, "text/html");
      const headingNodes = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"));
      const parsed = headingNodes
        .map((node) => {
          const level = Number((node.tagName || "H1").replace("H", ""));
          const text = (node.textContent || "").trim().replace(/\s+/g, " ");
          return { level: Number.isFinite(level) ? level : 1, text };
        })
        .filter((item) => item.text);
      return parsed;
    } catch {
      return [] as Array<{ level: number; text: string }>;
    }
  }, [writingDraftHtml]);
  const writingFilteredHeadings = useMemo(() => {
    const query = writingNavQuery.trim().toLowerCase();
    if (!query) return writingHeadings;
    return writingHeadings.filter((item) => item.text.toLowerCase().includes(query));
  }, [writingHeadings, writingNavQuery]);
  const writingPages = useMemo(() => {
    const query = writingNavQuery.trim().toLowerCase();
    return Array.from({ length: writingPageCount }, (_, index) => index + 1).filter((page) => {
      if (!query) return true;
      return `pagina ${page}`.includes(query) || String(page).includes(query);
    });
  }, [writingNavQuery, writingPageCount]);
  const writingFilteredWorks = useMemo(() => {
    const query = writingWorksQuery.trim().toLowerCase();
    if (!query) return writingWorks;
    return writingWorks.filter((item) => {
      const title = item.title.toLowerCase();
      const path = item.sourcePath.toLowerCase();
      const status = item.embeddingStatus.toLowerCase();
      return title.includes(query) || path.includes(query) || status.includes(query);
    });
  }, [writingWorks, writingWorksQuery]);

  useEffect(() => {
    setWriteSession((current) => (current.activeMode === activeMode ? current : { ...current, activeMode }));
  }, [activeMode]);

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
    if (!isWritingModeOpen) {
      writingPanelWasOpenRef.current = false;
      return;
    }
    if (writingPanelWasOpenRef.current) return;
    const editor = writingEditorRef.current;
    if (!editor) return;
    editor.innerHTML = writingDraftHtml;
    window.requestAnimationFrame(syncWritingPagination);
    writingPanelWasOpenRef.current = true;
  }, [isWritingModeOpen, writingDraftHtml]);

  useEffect(() => {
    if (!isWritingModeOpen) return;
    const editor = writingEditorRef.current;
    const scroller = writingScrollRef.current;
    if (!editor || !scroller) return;

    const updatePagination = () => syncWritingPagination();
    const handleScroll = () => syncWritingPagination();

    updatePagination();
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updatePagination) : null;
    resizeObserver?.observe(editor);
    scroller.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updatePagination);

    return () => {
      resizeObserver?.disconnect();
      scroller.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updatePagination);
    };
  }, [isWritingModeOpen]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const workspace = writingWorkspaceRef.current;
      if (!workspace) return;
      const workspaceWidth = workspace.getBoundingClientRect().width;
      if (!workspaceWidth) return;

      const navState = writingNavResizeRef.current;
      if (navState) {
        const deltaX = event.clientX - navState.startX;
        const deltaPercent = (deltaX / workspaceWidth) * 100;
        const nextPercent = clampNumber(
          navState.startWidthPercent + deltaPercent,
          WRITING_NAV_MIN_WIDTH_PERCENT,
          WRITING_NAV_MAX_WIDTH_PERCENT,
        );
        setWritingNavWidthPercent(nextPercent);
      }

      const worksState = writingWorksResizeRef.current;
      if (worksState) {
        const deltaX = worksState.startX - event.clientX;
        const deltaPercent = (deltaX / workspaceWidth) * 100;
        const nextPercent = clampNumber(
          worksState.startWidthPercent + deltaPercent,
          WRITING_WORKS_MIN_WIDTH_PERCENT,
          WRITING_WORKS_MAX_WIDTH_PERCENT,
        );
        setWritingWorksWidthPercent(nextPercent);
      }
    };

    const handleMouseUp = () => {
      writingNavResizeRef.current = null;
      writingWorksResizeRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSessionId(resolveClientSessionId());
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    setWriteSession((current) => {
      if (current.editorSessionId.includes(sessionId)) return current;
      return {
        ...current,
        editorSessionId: `editor-${sessionId}-${Date.now()}`,
      };
    });
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || typeof window === "undefined") return;
    const key = `knexai_writing_works:${sessionId}`;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        setWritingWorks([]);
        return;
      }
      const parsed = JSON.parse(raw) as WritingWork[];
      if (!Array.isArray(parsed)) {
        setWritingWorks([]);
        return;
      }
      const safeWorks = parsed
        .filter((item) => item && Number.isFinite(item.documentId) && typeof item.sourcePath === "string")
        .map((item) => ({
          documentId: item.documentId,
          sourcePath: item.sourcePath,
          title:
            typeof item.title === "string" && item.title.trim()
              ? item.title.trim()
              : normalizeWorkTitle(item.sourcePath, item.documentId),
          embeddingStatus:
            item.embeddingStatus === "completed" || item.embeddingStatus === "failed" || item.embeddingStatus === "pending"
              ? item.embeddingStatus
              : "pending",
          createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
          updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
        }))
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
      setWritingWorks(safeWorks);
    } catch {
      setWritingWorks([]);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || typeof window === "undefined") return;
    const key = `knexai_writing_works:${sessionId}`;
    try {
      window.localStorage.setItem(key, JSON.stringify(writingWorks));
    } catch {
      // noop: cache local complementar para obras do modo escrita.
    }
  }, [sessionId, writingWorks]);

  useEffect(() => {
    if (!activeThread || activeThread.documentScopeIds.length || !writingWorks.length) return;
    const defaults = resolveDefaultDocumentScopeIds(writingWorks);
    if (!defaults.length) return;
    setThreads((previous) =>
      previous.map((thread) =>
        thread.id === activeThread.id
          ? {
              ...thread,
              documentScopeIds: defaults,
            }
          : thread,
      ),
    );
  }, [activeThread, writingWorks]);

  useEffect(() => {
    if (!isWritingModeOpen) return;
    let cancelled = false;
    const hydrateWriteWorkspace = async () => {
      try {
        const projects = await listWriteProjects(80);
        if (cancelled) return;
        setWriteProjects(projects);

        const preferredProjectId = writeSession.activeProjectId;
        const targetProjectId = preferredProjectId && projects.some((item) => item.project_id === preferredProjectId)
          ? preferredProjectId
          : projects[0]?.project_id;

        if (targetProjectId) {
          await openWriteProjectSession(targetProjectId, writeSession.activeSectionId);
          return;
        }

        setWriteSession((current) => ({
          ...current,
          activeProjectId: null,
          activeSectionId: null,
          loadedSections: [],
          loadedChunks: [],
          projectSummary: null,
          sectionSummary: null,
          hasUnsavedChanges: false,
          isSaving: false,
          saveError: null,
          lastSyncedAt: new Date().toISOString(),
        }));
        setWritingNotice("Nenhum projeto de escrita encontrado. Crie um novo para iniciar.");
      } catch (hydrateError: unknown) {
        if (cancelled) return;
        const message = hydrateError instanceof Error ? hydrateError.message : "Falha ao carregar workspace de escrita.";
        setWriteSession((current) => ({ ...current, isSaving: false, saveError: message }));
        setWritingError(message);
      }
    };
    void hydrateWriteWorkspace();
    return () => {
      cancelled = true;
    };
    // Intencionalmente dispara apenas ao entrar no modo escrita.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWritingModeOpen]);

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
        setThreads((previous) => {
          const previousById = new Map(previous.map((thread) => [thread.id, thread]));
          return mapped.map((thread) => {
            const existing = previousById.get(thread.id);
            if (!existing) return thread;
            return {
              ...thread,
              documentScopeIds: normalizeDocumentScopeIds(existing.documentScopeIds),
            };
          });
        });
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
      documentScopeIds: thread.documentScopeIds,
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

  const persistMessage = async (
    threadId: string | null,
    role: "user" | "assistant",
    content: string,
    metadata?: Record<string, unknown>,
  ) => {
    if (!sessionId || !threadId || !content.trim()) return;
    try {
      await savePersistedMessage({ sessionId, threadId, role, content, metadata });
    } catch (persistError) {
      console.warn("KNEXAI_MESSAGE_PERSIST_WARN", persistError);
    }
  };

  const resolveComposerSessionId = () => {
    const normalized = sessionId.trim();
    if (normalized) return normalized;
    if (typeof window === "undefined") return "";
    const generated = resolveClientSessionId();
    setSessionId(generated);
    return generated;
  };

  const ingestFile = async (file: File): Promise<IngestSingleResult> => {
    const normalizedSessionId = resolveComposerSessionId();
    if (!normalizedSessionId) {
      throw new Error("Nao foi possivel resolver sessionId para ingestao.");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("sessionId", normalizedSessionId);
    formData.append("sourceType", "user_upload");
    formData.append("metadata", JSON.stringify({ ingested_via: "chat_composer_upload" }));

    const response = await fetch("/api/ingest", {
      method: "POST",
      body: formData,
    });
    const payload = await parseJsonResponse<IngestSingleResponse>(response);
    if (!response.ok || !payload?.ok || !payload.result) {
      throw new Error(payload?.message || `Falha ao ingerir "${file.name}" (HTTP ${response.status}).`);
    }
    return payload.result;
  };

  const registerIngestedWorks = (results: IngestSingleResult[]) => {
    if (!results.length) return;
    const nowIso = new Date().toISOString();
    setWritingWorks((prev) => {
      const map = new Map<number, WritingWork>();
      for (const item of prev) {
        map.set(item.documentId, item);
      }
      for (const result of results) {
        const current = map.get(result.documentId);
        const nextTitle = (result.title || "").trim() || current?.title || normalizeWorkTitle(result.sourcePath, result.documentId);
        map.set(result.documentId, {
          documentId: result.documentId,
          sourcePath: result.sourcePath,
          title: nextTitle,
          embeddingStatus: result.embeddingStatus,
          createdAt: current?.createdAt ?? nowIso,
          updatedAt: nowIso,
        });
      }
      return Array.from(map.values()).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    });
  };

  const handleComposerFiles = async (files: File[]) => {
    const validFiles = files.filter((file) => file && file.size > 0);
    if (!validFiles.length || isUploadingFiles) return;

    setUploadNotice(null);
    setUploadError(null);
    setIsUploadingFiles(true);
    try {
      const results: IngestSingleResult[] = [];
      for (const file of validFiles) {
        const result = await ingestFile(file);
        results.push(result);
      }
      const pendingEmbeddings = results.filter((result) => result.embeddingStatus === "pending").length;
      const completedEmbeddings = results.filter((result) => result.embeddingStatus === "completed").length;
      const noticeBase = `${results.length} arquivo(s) enviado(s) para ingestao no RAG.`;
      const noticeEmbeddings =
        pendingEmbeddings > 0
          ? ` ${pendingEmbeddings} em processamento de embeddings.`
          : completedEmbeddings > 0
            ? " Embeddings concluidos."
            : "";
      registerIngestedWorks(results);
      const uploadedDocumentIds = normalizeDocumentScopeIds(results.map((item) => item.documentId));
      if (activeMode === "chat" && activeThread && uploadedDocumentIds.length) {
        setThreads((previous) =>
          previous.map((thread) =>
            thread.id === activeThread.id
              ? {
                  ...thread,
                  updatedAt: Date.now(),
                  documentScopeIds: mergeDocumentScopeIds(thread.documentScopeIds, uploadedDocumentIds),
                }
              : thread,
          ),
        );
      }
      setUploadNotice(`${noticeBase}${noticeEmbeddings} Obras registradas no painel lateral direito.`);
      setUploadError(null);
    } catch (ingestError: unknown) {
      const message = ingestError instanceof Error ? ingestError.message : "Falha ao enviar arquivo para ingestao.";
      setUploadError(message);
      setUploadNotice(null);
    } finally {
      setIsUploadingFiles(false);
    }
  };

  const handlePickFiles = () => {
    if (isUploadingFiles) return;
    fileInputRef.current?.click();
  };

  const syncWritingPagination = () => {
    const editor = writingEditorRef.current;
    const scroller = writingScrollRef.current;
    const pageRoot = writingPageRootRef.current;
    if (!editor) return;

    const totalHeight = Math.max(editor.scrollHeight, writingPageStridePx);
    const nextPageCount = Math.max(1, Math.ceil(totalHeight / writingPageStridePx));
    const nextBreaks = Array.from({ length: Math.max(0, nextPageCount - 1) }, (_, index) => (index + 1) * writingPageStridePx);
    const nextFillRatios = Array.from({ length: nextPageCount }, (_, index) => {
      const start = index * writingPageStridePx;
      const remaining = totalHeight - start;
      return clampNumber(remaining / writingPageHeightPx, 0, 1);
    });

    setWritingPageCount((current) => (current === nextPageCount ? current : nextPageCount));
    setWritingPageBreakOffsets((current) => {
      if (current.length === nextBreaks.length && current.every((value, index) => value === nextBreaks[index])) {
        return current;
      }
      return nextBreaks;
    });
    setWritingPageFillRatios((current) => {
      if (current.length === nextFillRatios.length && current.every((value, index) => value === nextFillRatios[index])) {
        return current;
      }
      return nextFillRatios;
    });

    if (!scroller || !pageRoot) return;
    const relativeTop = Math.max(0, scroller.scrollTop - pageRoot.offsetTop);
    const visiblePage = clampNumber(Math.floor((relativeTop + writingPageGapPx / 2) / writingPageStridePx) + 1, 1, nextPageCount);
    setWritingActivePage((current) => (current === visiblePage ? current : visiblePage));
  };

  const jumpToWritingPage = (pageNumber: number) => {
    const scroller = writingScrollRef.current;
    const pageRoot = writingPageRootRef.current;
    if (!scroller || !pageRoot) return;
    const normalizedPage = clampNumber(pageNumber, 1, Math.max(1, writingPageCount));
    const top = pageRoot.offsetTop + (normalizedPage - 1) * writingPageStridePx;
    scroller.scrollTo({ top, behavior: "smooth" });
    setWritingActivePage(normalizedPage);
  };

  const focusWritingEditor = () => {
    const editor = writingEditorRef.current;
    if (!editor) return null;
    editor.focus();
    return editor;
  };

  const applyWritingCommand = (command: WritingFormatCommand, value?: string) => {
    const editor = focusWritingEditor();
    if (!editor) return;
    document.execCommand(command, false, value);
    setWritingDraftHtml(editor.innerHTML);
    window.requestAnimationFrame(syncWritingPagination);
  };

  const insertWritingText = (text: string) => {
    const editor = focusWritingEditor();
    if (!editor) return;
    const normalized = text.trim();
    if (!normalized) return;
    const prefixed = `\n\n${normalized}`;
    const inserted = document.execCommand("insertText", false, prefixed);
    if (!inserted) {
      const paragraph = document.createElement("p");
      paragraph.textContent = normalized;
      editor.appendChild(paragraph);
    }
    setWritingDraftHtml(editor.innerHTML);
    window.requestAnimationFrame(syncWritingPagination);
  };

  const jumpToWritingHeading = (headingText: string) => {
    const editor = writingEditorRef.current;
    if (!editor) return;
    const target = Array.from(editor.querySelectorAll("h1, h2, h3, h4, h5, h6")).find(
      (node) => (node.textContent || "").trim() === headingText,
    );
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    editor.focus();
  };

  const startWritingNavResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (isWritingNavCollapsed) return;
    writingNavResizeRef.current = {
      startX: event.clientX,
      startWidthPercent: writingNavWidthPercent,
    };
  };

  const startWritingWorksResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (isWritingWorksCollapsed) return;
    writingWorksResizeRef.current = {
      startX: event.clientX,
      startWidthPercent: writingWorksWidthPercent,
    };
  };

  const resolveSafeSectionSummary = async (sectionId: string | null) => {
    if (!sectionId) return null;
    try {
      return await getWriteSectionSummary(sectionId);
    } catch {
      return null;
    }
  };

  const resolveSafeProjectSummary = async (projectId: string | null) => {
    if (!projectId) return null;
    try {
      return await getWriteProjectGlobalSummary(projectId);
    } catch {
      return null;
    }
  };

  const applySectionToEditor = (section: WriteSectionView | null) => {
    const nextHtml = composeSectionHtml(section);
    setWritingDraftHtml(nextHtml);
    const editor = writingEditorRef.current;
    if (editor) {
      editor.innerHTML = nextHtml;
      window.requestAnimationFrame(syncWritingPagination);
    }
  };

  const refreshWriteProjects = async () => {
    const projects = await listWriteProjects(80);
    setWriteProjects(projects);
    return projects;
  };

  const openWriteProjectSession = async (projectId: string, preferredSectionId?: string | null) => {
    setWriteSession((current) => ({
      ...current,
      activeProjectId: projectId,
      isSaving: true,
      saveError: null,
    }));
    setWritingError(null);
    setWritingNotice(null);
    try {
      const [project, sections] = await Promise.all([
        getWriteProject(projectId),
        listWriteProjectSections(projectId, { includeChunks: true, includeSummaries: true }),
      ]);
      const sortedSections = [...sections].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
      const activeSection =
        sortedSections.find((item) => item.section_id === (preferredSectionId || "")) || sortedSections[0] || null;
      const [sectionSummary, projectSummary] = await Promise.all([
        resolveSafeSectionSummary(activeSection?.section_id ?? null),
        resolveSafeProjectSummary(projectId),
      ]);

      applySectionToEditor(activeSection);
      setWritingTitle(project.title || "Documento sem titulo");
      setWriteSession((current) => ({
        ...current,
        activeProjectId: project.project_id,
        activeSectionId: activeSection?.section_id ?? null,
        loadedSections: sortedSections,
        loadedChunks: activeSection?.chunks || [],
        sectionSummary,
        projectSummary,
        hasUnsavedChanges: false,
        isSaving: false,
        isGenerating: false,
        saveError: null,
        lastSyncedAt: new Date().toISOString(),
      }));
      if (!activeSection) {
        setWritingNotice("Projeto carregado sem secoes. Crie a primeira secao para iniciar.");
      }
    } catch (openError: unknown) {
      const message = openError instanceof Error ? openError.message : "Falha ao carregar projeto de escrita.";
      setWriteSession((current) => ({
        ...current,
        isSaving: false,
        saveError: message,
      }));
      setWritingError(message);
    }
  };

  const handleSelectWriteSection = async (sectionId: string) => {
    const nextSection = writeSession.loadedSections.find((item) => item.section_id === sectionId) || null;
    if (!nextSection) return;
    applySectionToEditor(nextSection);
    setWriteSession((current) => ({
      ...current,
      activeSectionId: nextSection.section_id,
      loadedChunks: nextSection.chunks || [],
      hasUnsavedChanges: false,
      saveError: null,
      lastSyncedAt: new Date().toISOString(),
    }));
    const [sectionSummary, projectSummary] = await Promise.all([
      resolveSafeSectionSummary(nextSection.section_id),
      resolveSafeProjectSummary(nextSection.project_id),
    ]);
    setWriteSession((current) => ({
      ...current,
      sectionSummary,
      projectSummary,
    }));
  };

  const handleCreateWriteProject = async () => {
    setWriteSession((current) => ({ ...current, isSaving: true, saveError: null }));
    try {
      const createdProject = await createWriteProject({
        title: `Projeto ${new Date().toLocaleDateString("pt-BR")}`,
        description: "",
        objective: "",
        session_id: sessionId || undefined,
        metadata: { origin: "knexai-web" },
      });
      const firstSection = await createWriteSection(createdProject.project_id, {
        title: "Secao 1",
        order: 0,
        objective: "Definir objetivo desta secao.",
        outline_notes: "",
        status: "planned",
        content: "",
      });
      await refreshWriteProjects();
      await openWriteProjectSession(createdProject.project_id, firstSection.section_id);
      setWritingNotice("Novo projeto de escrita criado.");
    } catch (createError: unknown) {
      const message = createError instanceof Error ? createError.message : "Falha ao criar projeto de escrita.";
      setWriteSession((current) => ({ ...current, isSaving: false, saveError: message }));
      setWritingError(message);
    }
  };

  const sendWritingAssist = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || writingStatus === "thinking" || writeSession.isGenerating) return;

    setWritingPrompt("");
    setWritingStatus("thinking");
    setWritingError(null);
    setWritingNotice(null);
    setWriteSession((current) => ({
      ...current,
      currentInstruction: trimmed,
      isGenerating: true,
      saveError: null,
    }));

    const activeProjectId = writeSession.activeProjectId;
    const activeSectionId = writeSession.activeSectionId;

    if (activeProjectId && activeSectionId) {
      try {
        const payload = await continueWrite({
          project_id: activeProjectId,
          section_id: activeSectionId,
          instruction: trimmed,
        });
        insertWritingText(payload.chunk.text);
        setWriteSession((current) => ({
          ...current,
          loadedChunks: [...current.loadedChunks, payload.chunk],
          loadedSections: current.loadedSections.map((section) =>
            section.section_id === payload.section_id ? { ...section, chunks: [...section.chunks, payload.chunk] } : section,
          ),
          sectionSummary: payload.section_summary_used || current.sectionSummary,
          projectSummary: payload.project_global_summary_used || current.projectSummary,
          isGenerating: false,
          hasUnsavedChanges: false,
          lastSyncedAt: new Date().toISOString(),
          saveError: null,
        }));
        setWritingStatus("idle");
        setWritingNotice("Novo bloco gerado com o fluxo /write/continue.");
      } catch (continueError: unknown) {
        const message = continueError instanceof Error ? continueError.message : "Falha ao gerar continuidade de escrita.";
        setWriteSession((current) => ({
          ...current,
          isGenerating: false,
          saveError: message,
        }));
        setWritingStatus("error");
        setWritingError(message);
      }
      return;
    }

    let assistantResponse = "";
    const controller = new AbortController();
    try {
      const worksContext = writingWorks
        .slice(0, 24)
        .map(
          (work, index) =>
            `${index + 1}. [doc:${work.documentId}] ${work.title} | ${work.sourcePath} | embeddings:${work.embeddingStatus}`,
        )
        .join("\n");
      const promptWithWorks = worksContext
        ? [
            "Contexto fixo do modo escrita:",
            "Considere as obras registradas abaixo como base recorrente de consulta durante esta resposta.",
            "Se alguma obra estiver com embeddings pendentes, trate como referencia parcial.",
            "Obras registradas:",
            worksContext,
            "",
            "Pedido de escrita do usuario:",
            trimmed,
          ].join("\n")
        : trimmed;
      await streamLeticia(promptWithWorks, [], {
        signal: controller.signal,
        onChunk: (delta) => {
          assistantResponse += delta;
        },
        onDone: () => {
          setWritingStatus("idle");
        },
      });
      insertWritingText(assistantResponse);
      setWriteSession((current) => ({
        ...current,
        isGenerating: false,
        hasUnsavedChanges: true,
      }));
      setWritingNotice("Trecho gerado e inserido no documento.");
    } catch (assistError: unknown) {
      const message = assistError instanceof Error ? assistError.message : "Falha ao gerar texto no modo escrita.";
      setWriteSession((current) => ({
        ...current,
        isGenerating: false,
        saveError: message,
      }));
      setWritingStatus("error");
      setWritingError(message);
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
      documentScopeIds: [],
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
    const scopedDocumentIds = normalizeDocumentScopeIds(
      activeThread.documentScopeIds.length ? activeThread.documentScopeIds : resolveDefaultDocumentScopeIds(writingWorks),
    );

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
    void persistMessage(storedThreadId, "user", trimmed, {
      rag_document_ids: scopedDocumentIds,
    });

    let assistantResponse = "";
    try {
      await streamLeticia(
        trimmed,
        historyForModel,
        {
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
        },
        {
          documentIds: scopedDocumentIds,
          documentId: scopedDocumentIds.length === 1 ? scopedDocumentIds[0] : undefined,
        },
      );
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

  const removeActiveThreadDocument = (documentId: number) => {
    if (!activeThread) return;
    setThreads((previous) =>
      previous.map((thread) =>
        thread.id === activeThread.id
          ? {
              ...thread,
              documentScopeIds: thread.documentScopeIds.filter((item) => item !== documentId),
              updatedAt: Date.now(),
            }
          : thread,
      ),
    );
  };

  const clearActiveThreadDocumentScope = () => {
    if (!activeThread) return;
    setThreads((previous) =>
      previous.map((thread) =>
        thread.id === activeThread.id
          ? {
              ...thread,
              documentScopeIds: [],
              updatedAt: Date.now(),
            }
          : thread,
      ),
    );
  };

  return (
    <main className="flex h-screen min-h-screen bg-[#f7f7f8] text-zinc-900">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.currentTarget.value = "";
          if (!files.length) return;
          void handleComposerFiles(files);
        }}
      />
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
                  <span className="mt-0.5 text-zinc-500">-</span>
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

      <section className="flex min-w-0 flex-1 flex-col bg-white">
        <header className="flex h-14 items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-medium sm:text-[34px]">
              L.E.T.I.C.I.A. <span className="font-normal text-zinc-500">KnexAI</span>
            </h1>
            <span
              className={`inline-flex items-center border px-2 py-0.5 text-xs font-medium uppercase tracking-[0.09em] ${
                activeMode === "write"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-blue-300 bg-blue-50 text-blue-700"
              }`}
            >
              {activeMode === "write" ? "Modo Escrever" : "Modo Chat"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-zinc-700">
            <div className="inline-flex items-center border border-zinc-300 bg-zinc-100 p-0.5">
              <button
                type="button"
                onClick={() => setActiveMode("chat")}
                className={`px-3 py-1 text-sm font-medium ${activeMode === "chat" ? "bg-white text-zinc-900" : "text-zinc-600 hover:bg-zinc-200"}`}
              >
                Chat
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMode("write");
                  setWritingError(null);
                  setWritingNotice(null);
                }}
                className={`px-3 py-1 text-sm font-medium ${
                  activeMode === "write" ? "bg-white text-zinc-900" : "text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                Escrever
              </button>
            </div>
            <Link
              href="/knexai/ingest"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-zinc-200"
            >
              <Upload size={16} />
              <span className="hidden sm:inline">Ingerir arquivo</span>
            </Link>
            <button type="button" className="rounded-lg p-2 hover:bg-zinc-200">
              <MoreHorizontal size={18} />
            </button>
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col">
          {activeMode === "chat" ? (
            !showChat ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
                <p className="mb-7 text-center text-5xl font-normal text-zinc-900">O que tem na agenda de hoje?</p>
                <Composer
                  docked={false}
                  input={input}
                  status={status}
                  isUploadingFiles={isUploadingFiles}
                  uploadNotice={uploadNotice}
                  uploadError={uploadError}
                  onInputChange={setInput}
                  onSend={() => void send(input)}
                  onPickFiles={handlePickFiles}
                  onFilesSelected={(files) => {
                    void handleComposerFiles(files);
                  }}
                />
                {activeThreadDocumentWorks.length ? (
                  <div className="mt-4 w-full max-w-3xl rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-600">
                        Documentos RAG ativos neste chat
                      </p>
                      <button
                        type="button"
                        onClick={clearActiveThreadDocumentScope}
                        className="text-xs font-medium text-zinc-600 hover:text-zinc-800"
                      >
                        Limpar escopo
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activeThreadDocumentWorks.map((work) => (
                        <span
                          key={work.documentId}
                          className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700"
                          title={work.sourcePath}
                        >
                          <span>{`doc:${work.documentId} ${work.title}`}</span>
                          <button
                            type="button"
                            onClick={() => removeActiveThreadDocument(work.documentId)}
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"
                            aria-label={`Remover documento ${work.documentId} do escopo do chat`}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]" style={{ scrollPaddingBottom: `${composerReservePx}px` }}>
                  <div className={`mx-auto w-full px-6 pt-5 pb-6 ${hasStructuredAssistantResponse ? "max-w-6xl" : "max-w-4xl"}`}>
                    {activeMessages.map((message, index) => (
                      <div
                        key={`${activeThread?.id ?? "thread"}-${index}`}
                        className={`mb-4 flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {(() => {
                          const isLastAssistant = message.role === "assistant" && index === activeMessages.length - 1;
                          const currentAssistantData = assistantRenderData[index];
                          const assistantMode = currentAssistantData?.mode;
                          const contentToRender =
                            message.role === "assistant" && currentAssistantData ? currentAssistantData.content : message.content;
                          const whitespaceClass = message.role === "assistant" && assistantMode === "plain" ? "whitespace-pre" : "whitespace-pre-wrap";
                          return (
                            <div
                              ref={isLastAssistant ? lastAssistantBubbleRef : null}
                              className={`${whitespaceClass} text-[22px] leading-relaxed ${
                                message.role === "user"
                                  ? "max-w-[85%] rounded-2xl bg-zinc-900 px-4 py-3 text-white"
                                  : assistantMode === "plain"
                                    ? "w-full max-w-none overflow-x-auto rounded-2xl bg-zinc-100 px-4 py-3 font-mono text-zinc-900"
                                    : "w-full max-w-none text-zinc-900"
                              }`}
                            >
                              {contentToRender || (
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
                    {activeThreadDocumentWorks.length ? (
                      <div className="mb-2 rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-2">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-600">
                            Documentos RAG ativos neste chat
                          </p>
                          <button
                            type="button"
                            onClick={clearActiveThreadDocumentScope}
                            className="text-xs font-medium text-zinc-600 hover:text-zinc-800"
                          >
                            Limpar escopo
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {activeThreadDocumentWorks.map((work) => (
                            <span
                              key={work.documentId}
                              className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700"
                              title={work.sourcePath}
                            >
                              <span>{`doc:${work.documentId} ${work.title}`}</span>
                              <button
                                type="button"
                                onClick={() => removeActiveThreadDocument(work.documentId)}
                                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"
                                aria-label={`Remover documento ${work.documentId} do escopo do chat`}
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <Composer
                      docked
                      input={input}
                      status={status}
                      isUploadingFiles={isUploadingFiles}
                      uploadNotice={uploadNotice}
                      uploadError={uploadError}
                      onInputChange={setInput}
                      onSend={() => void send(input)}
                      onPickFiles={handlePickFiles}
                      onFilesSelected={(files) => {
                        void handleComposerFiles(files);
                      }}
                    />
                  </div>
                </div>
              </>
            )
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 text-center">
              <div className="max-w-2xl border border-zinc-300 bg-zinc-50 px-6 py-8">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-500">Modo Escrever</p>
                <p className="mt-2 text-lg text-zinc-800">Workspace de escrita ativo. Use o editor, secoes e resumos no painel principal.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {activeMode === "write" ? (
      <div className="fixed inset-0 z-[60] pointer-events-auto" aria-hidden={false}>
        <div
          className="absolute inset-0 bg-black/10"
          onClick={() => setActiveMode("chat")}
        />
        <section
          className="absolute inset-y-0 right-0 flex w-full flex-col bg-[#f4f4f5]"
        >
          <button
            type="button"
            onClick={() => setActiveMode("chat")}
            className="absolute bottom-6 right-6 z-10 inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white/95 px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm backdrop-blur hover:bg-white"
            aria-label="Colapsar modo escrita para a direita e voltar ao chat"
            title="Voltar ao chat"
          >
            <PanelRightClose size={16} />
            <span className="hidden sm:inline">Voltar ao chat</span>
          </button>

          <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-5 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white">
                <FilePenLine size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Workspace</p>
                <input
                  value={writingTitle}
                  onChange={(event) => setWritingTitle(event.target.value)}
                  className="w-[min(70vw,560px)] truncate border-0 bg-transparent p-0 text-lg font-semibold text-zinc-900 outline-none"
                  placeholder="Titulo do documento"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={writeSession.isSaving}
                onClick={() => {
                  setWriteSession((current) => ({ ...current, isSaving: true, saveError: null }));
                  const editor = writingEditorRef.current;
                  if (!editor) {
                    setWriteSession((current) => ({ ...current, isSaving: false }));
                    return;
                  }
                  const html = editor.innerHTML;
                  setWritingDraftHtml(html);
                  try {
                    if (typeof window !== "undefined") {
                      const key = `knexai_writing_draft:${sessionId.trim() || "anon"}`;
                      window.localStorage.setItem(key, html);
                    }
                  } catch {
                    // noop
                  }
                  setWriteSession((current) => ({
                    ...current,
                    isSaving: false,
                    hasUnsavedChanges: false,
                    lastSyncedAt: new Date().toISOString(),
                  }));
                  setWritingNotice("Rascunho salvo localmente.");
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={15} />
                {writeSession.isSaving ? "Salvando..." : "Salvar"}
              </button>
              <button
                type="button"
                onClick={() => setActiveMode("chat")}
                className="rounded-lg p-2 text-zinc-700 hover:bg-zinc-100"
                aria-label="Fechar modo escrita"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          <div className="flex h-12 items-center gap-2 border-b border-zinc-300 bg-[#f7f7f8] px-5 lg:px-8">
            <button
              type="button"
              onClick={() => {
                void handleCreateWriteProject();
              }}
              className="inline-flex h-8 items-center border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Novo projeto
            </button>
            <select
              value={writeSession.activeProjectId ?? ""}
              onChange={(event) => {
                const nextProjectId = event.target.value;
                if (!nextProjectId) return;
                void openWriteProjectSession(nextProjectId, null);
              }}
              className="h-8 min-w-[220px] border border-zinc-300 bg-white px-2 text-sm text-zinc-700"
              aria-label="Selecionar projeto de escrita"
            >
              {!writeProjects.length ? <option value="">Sem projetos</option> : null}
              {writeProjects.map((project) => (
                <option key={project.project_id} value={project.project_id}>
                  {project.title}
                </option>
              ))}
            </select>
            <select
              value={writeSession.activeSectionId ?? ""}
              onChange={(event) => {
                const nextSectionId = event.target.value;
                if (!nextSectionId) return;
                void handleSelectWriteSection(nextSectionId);
              }}
              className="h-8 min-w-[200px] border border-zinc-300 bg-white px-2 text-sm text-zinc-700"
              aria-label="Selecionar secao ativa"
              disabled={!writeSession.loadedSections.length}
            >
              {!writeSession.loadedSections.length ? <option value="">Sem secoes</option> : null}
              {writeSession.loadedSections.map((section) => (
                <option key={section.section_id} value={section.section_id}>
                  {section.order + 1}. {section.title}
                </option>
              ))}
            </select>
            <div className="ml-auto flex items-center gap-2 text-xs">
              {writeSession.isGenerating ? (
                <span className="border border-blue-300 bg-blue-50 px-2 py-0.5 font-medium text-blue-700">Gerando bloco...</span>
              ) : null}
              <span
                className={`border px-2 py-0.5 font-medium ${
                  writeSession.hasUnsavedChanges ? "border-amber-300 bg-amber-50 text-amber-700" : "border-emerald-300 bg-emerald-50 text-emerald-700"
                }`}
              >
                {writeSession.hasUnsavedChanges ? "Alteracoes locais" : "Sincronizado"}
              </span>
              {writeSession.lastSyncedAt ? (
                <span className="text-zinc-500">Sync: {new Date(writeSession.lastSyncedAt).toLocaleTimeString("pt-BR")}</span>
              ) : null}
            </div>
          </div>

          <div className="flex h-12 items-center border-b border-zinc-300 bg-white px-5 lg:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => applyWritingCommand("formatBlock", "<h1>")}
                className="inline-flex h-8 items-center gap-1 border border-zinc-300 px-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                <Heading1 size={14} />
                Titulo
              </button>
              <button
                type="button"
                onClick={() => applyWritingCommand("bold")}
                className="inline-flex h-8 w-8 items-center justify-center border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                aria-label="Negrito"
              >
                <Bold size={14} />
              </button>
              <button
                type="button"
                onClick={() => applyWritingCommand("italic")}
                className="inline-flex h-8 w-8 items-center justify-center border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                aria-label="Italico"
              >
                <Italic size={14} />
              </button>
              <button
                type="button"
                onClick={() => applyWritingCommand("underline")}
                className="inline-flex h-8 w-8 items-center justify-center border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                aria-label="Sublinhado"
              >
                <Underline size={14} />
              </button>
              <button
                type="button"
                onClick={() => applyWritingCommand("insertUnorderedList")}
                className="inline-flex h-8 w-8 items-center justify-center border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                aria-label="Lista"
              >
                <List size={14} />
              </button>
              <button
                type="button"
                onClick={() => applyWritingCommand("insertOrderedList")}
                className="inline-flex h-8 w-8 items-center justify-center border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                aria-label="Lista numerada"
              >
                <ListOrdered size={14} />
              </button>
              <button
                type="button"
                onClick={() => applyWritingCommand("formatBlock", "<blockquote>")}
                className="inline-flex h-8 w-8 items-center justify-center border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                aria-label="Bloco de citacao"
              >
                <Minus size={14} />
              </button>
            </div>
          </div>

          <div ref={writingWorkspaceRef} className="relative flex min-h-0 flex-1">
            <aside
              className="relative flex h-full min-h-0 shrink-0 flex-col border-r border-zinc-300 bg-[#e7e7ea]"
              style={{ width: isWritingNavCollapsed ? "26px" : `${writingNavWidthPercent}%` }}
            >
              <button
                type="button"
                onClick={() => setIsWritingNavCollapsed((current) => !current)}
                className="flex h-10 w-full items-center justify-center border-b border-zinc-300 text-zinc-700 hover:bg-zinc-200"
                aria-label={isWritingNavCollapsed ? "Expandir painel de navegacao" : "Colapsar painel de navegacao"}
                title={isWritingNavCollapsed ? "Expandir navegacao" : "Colapsar navegacao"}
              >
                {isWritingNavCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>

              {!isWritingNavCollapsed ? (
                <>
                  <div className="border-b border-zinc-300 px-3 py-3">
                    <p className="text-xl font-medium text-zinc-800">Navegacao</p>
                    <div className="mt-2 flex items-center gap-2 border border-zinc-300 bg-white px-2 py-2">
                      <Search size={13} className="text-zinc-500" />
                      <input
                        value={writingNavQuery}
                        onChange={(event) => setWritingNavQuery(event.target.value)}
                        placeholder="Buscar titulo"
                        className="w-full border-0 bg-transparent text-sm text-zinc-700 outline-none"
                      />
                    </div>
                    <div className="mt-2 flex gap-1 text-sm">
                      <button
                        type="button"
                        onClick={() => setWritingNavTab("titles")}
                        className={`border border-zinc-300 px-2 py-1 ${
                          writingNavTab === "titles" ? "bg-white text-zinc-900" : "text-zinc-600 hover:bg-zinc-200"
                        }`}
                      >
                        Titulos
                      </button>
                      <button
                        type="button"
                        onClick={() => setWritingNavTab("pages")}
                        className={`border border-zinc-300 px-2 py-1 ${
                          writingNavTab === "pages" ? "bg-white text-zinc-900" : "text-zinc-600 hover:bg-zinc-200"
                        }`}
                      >
                        Paginas
                      </button>
                      <button
                        type="button"
                        onClick={() => setWritingNavTab("results")}
                        className={`border border-zinc-300 px-2 py-1 ${
                          writingNavTab === "results" ? "bg-white text-zinc-900" : "text-zinc-600 hover:bg-zinc-200"
                        }`}
                      >
                        Resultados
                      </button>
                    </div>
                  </div>

                  <div className={`flex-1 ${writingNavTab === "pages" ? "overflow-hidden p-0" : "overflow-y-auto p-2"}`}>
                    {writingNavTab === "titles" ? (
                      writingFilteredHeadings.length ? (
                        <div className="space-y-1">
                          {writingFilteredHeadings.map((heading, index) => (
                            <button
                              key={`${heading.level}-${heading.text}-${index}`}
                              type="button"
                              onClick={() => jumpToWritingHeading(heading.text)}
                              className="block w-full px-2 py-1 text-left text-sm text-zinc-700 hover:bg-white"
                              style={{ paddingLeft: `${Math.max(8, heading.level * 10)}px` }}
                            >
                              {heading.text}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-600">Nenhum titulo identificado no texto.</p>
                      )
                    ) : null}
                    {writingNavTab === "pages" ? (
                      <div className="flex h-full min-h-0">
                        <div className="flex w-10 shrink-0 flex-col items-center gap-2 border-r border-zinc-300 bg-[#ececef] py-2">
                          <button type="button" className="inline-flex h-7 w-7 items-center justify-center text-zinc-700 hover:bg-zinc-300" title="Marcadores">
                            <Bookmark size={14} />
                          </button>
                          <button type="button" className="inline-flex h-7 w-7 items-center justify-center text-zinc-700 hover:bg-zinc-300" title="Comentarios">
                            <CircleEllipsis size={14} />
                          </button>
                          <button type="button" className="inline-flex h-7 w-7 items-center justify-center text-zinc-700 hover:bg-zinc-300" title="Miniaturas">
                            <LayoutGrid size={14} />
                          </button>
                          <button type="button" className="inline-flex h-7 w-7 items-center justify-center text-zinc-700 hover:bg-zinc-300" title="Anexos">
                            <Upload size={14} />
                          </button>
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="border-b border-zinc-300 bg-[#f0f0f2] px-3 py-2">
                            <p className="text-[29px] font-medium text-zinc-800">Paginas</p>
                            <div className="mt-2 flex items-center gap-1 text-zinc-700">
                              <button type="button" className="inline-flex h-7 w-7 items-center justify-center hover:bg-zinc-300" title="Atualizar miniaturas">
                                <RefreshCw size={14} />
                              </button>
                              <button type="button" className="inline-flex h-7 w-7 items-center justify-center hover:bg-zinc-300" title="Duplicar pagina">
                                <Copy size={14} />
                              </button>
                              <button type="button" className="inline-flex h-7 w-7 items-center justify-center hover:bg-zinc-300" title="Rotacionar para esquerda">
                                <RotateCcw size={14} />
                              </button>
                              <button type="button" className="inline-flex h-7 w-7 items-center justify-center hover:bg-zinc-300" title="Rotacionar para direita">
                                <RotateCw size={14} />
                              </button>
                              <button type="button" className="inline-flex h-7 w-7 items-center justify-center hover:bg-zinc-300" title="Inspecionar pagina">
                                <ScanSearch size={14} />
                              </button>
                            </div>
                          </div>
                          <div className="min-h-0 flex-1 overflow-y-auto bg-[#e6e6ea] px-2 py-2">
                            {writingPages.length ? (
                              <div className="space-y-3">
                                {writingPages.map((pageNumber) => {
                                  const isActive = writingActivePage === pageNumber;
                                  const fillRatio = writingPageFillRatios[pageNumber - 1] ?? 0;
                                  const lineCount = Math.max(3, Math.round(fillRatio * 24));
                                  return (
                                    <div key={`page-nav-${pageNumber}`} className={`px-1 py-1 ${isActive ? "bg-sky-100" : "bg-transparent"}`}>
                                      <button type="button" onClick={() => jumpToWritingPage(pageNumber)} className="block w-full text-left">
                                        <span
                                          className={`relative mx-auto block aspect-[210/297] w-full border bg-white ${
                                            isActive ? "border-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.35)]" : "border-zinc-400"
                                          }`}
                                        >
                                          <span className="absolute left-[9.5%] right-[9.5%] top-[8.5%] bottom-[11%]">
                                            {Array.from({ length: lineCount }, (_, lineIndex) => (
                                              <span
                                                key={`page-${pageNumber}-line-${lineIndex}`}
                                                className="absolute left-0 h-[4px] bg-zinc-300"
                                                style={{
                                                  right: `${8 + ((lineIndex * 7) % 26)}%`,
                                                  top: `${lineIndex * 4.05}%`,
                                                }}
                                              />
                                            ))}
                                          </span>
                                        </span>
                                        <span className="mt-1 block text-center text-sm font-medium text-zinc-700">{pageNumber}</span>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="px-2 py-3 text-sm text-zinc-600">Nenhuma pagina disponivel para o filtro atual.</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 border-t border-zinc-300 bg-[#efeff1] px-2 py-1">
                            <button
                              type="button"
                              onClick={() => jumpToWritingPage(1)}
                              disabled={writingActivePage <= 1}
                              className="inline-flex h-7 w-7 items-center justify-center border border-zinc-300 bg-white text-zinc-700 disabled:opacity-40"
                              title="Primeira pagina"
                            >
                              <ChevronsLeft size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => jumpToWritingPage(writingActivePage - 1)}
                              disabled={writingActivePage <= 1}
                              className="inline-flex h-7 w-7 items-center justify-center border border-zinc-300 bg-white text-zinc-700 disabled:opacity-40"
                              title="Pagina anterior"
                            >
                              <ChevronLeft size={14} />
                            </button>
                            <select
                              value={writingActivePage}
                              onChange={(event) => jumpToWritingPage(Number(event.target.value))}
                              className="h-7 min-w-[88px] border border-zinc-300 bg-white px-2 text-sm text-zinc-700"
                              aria-label="Selecionar pagina"
                            >
                              {Array.from({ length: writingPageCount }, (_, index) => index + 1).map((pageNumber) => (
                                <option key={`page-select-${pageNumber}`} value={pageNumber}>
                                  {pageNumber} / {writingPageCount}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => jumpToWritingPage(writingActivePage + 1)}
                              disabled={writingActivePage >= writingPageCount}
                              className="inline-flex h-7 w-7 items-center justify-center border border-zinc-300 bg-white text-zinc-700 disabled:opacity-40"
                              title="Proxima pagina"
                            >
                              <ChevronRight size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => jumpToWritingPage(writingPageCount)}
                              disabled={writingActivePage >= writingPageCount}
                              className="inline-flex h-7 w-7 items-center justify-center border border-zinc-300 bg-white text-zinc-700 disabled:opacity-40"
                              title="Ultima pagina"
                            >
                              <ChevronsRight size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {writingNavTab === "results" ? (
                      writingNavQuery.trim() ? (
                        writingFilteredHeadings.length ? (
                          <div className="space-y-1">
                            {writingFilteredHeadings.map((heading, index) => (
                              <button
                                key={`result-${heading.level}-${heading.text}-${index}`}
                                type="button"
                                onClick={() => jumpToWritingHeading(heading.text)}
                                className="block w-full px-2 py-1 text-left text-sm text-zinc-700 hover:bg-white"
                              >
                                {heading.text}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-zinc-600">Nenhum resultado para a busca atual.</p>
                        )
                      ) : (
                        <p className="text-sm text-zinc-600">Use a busca acima para listar resultados no documento.</p>
                      )
                    ) : null}
                  </div>
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Redimensionar painel de navegacao"
                    onMouseDown={startWritingNavResize}
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-zinc-400"
                  />
                </>
              ) : null}
            </aside>

            <div className="relative min-w-0 flex min-h-0 flex-1 flex-col">
              <div
                ref={writingScrollRef}
                className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]"
                style={{ scrollPaddingBottom: `${writingBottomClearancePx}px` }}
              >
                <div
                  ref={writingPageRootRef}
                  className="mx-auto w-full max-w-[1120px] px-6 pt-6 lg:px-10"
                  style={{ paddingBottom: `${writingBottomClearancePx}px` }}
                >
                  <div className="mx-auto mt-1 w-full bg-[#e8e8ec] px-3 py-3">
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1]">
                        {Array.from({ length: writingPageCount }, (_, index) => (
                          <div
                            key={`a4-sheet-${index + 1}`}
                            className="absolute left-1/2 -translate-x-1/2 border border-zinc-300 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.15)]"
                            style={{
                              top: `${index * writingPageStridePx}px`,
                              width: `min(100%, ${writingPageWidthPx}px)`,
                              height: `${writingPageHeightPx}px`,
                            }}
                          >
                            <div className="absolute inset-x-0 bottom-2 flex items-center justify-center text-sm font-medium text-zinc-700">
                              {index + 1}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="pointer-events-none absolute inset-x-0 top-0 z-[2]">
                        {writingPageBreakOffsets.map((offset, index) => (
                          <div
                            key={`page-break-${index}`}
                            className="absolute left-1/2 flex w-full max-w-[840px] -translate-x-1/2 items-center gap-3 text-[11px] uppercase tracking-[0.08em] text-zinc-400"
                            style={{ top: `${offset}px` }}
                          >
                            <span className="h-px flex-1 bg-zinc-300/80" />
                            <span>Quebra de pagina</span>
                            <span className="h-px flex-1 bg-zinc-300/80" />
                          </div>
                        ))}
                      </div>

                      <div
                        ref={writingEditorRef}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={(event) => {
                          const html = (event.currentTarget as HTMLDivElement).innerHTML;
                          setWritingDraftHtml(html);
                          setWritingNotice(null);
                          setWriteSession((current) => ({
                            ...current,
                            hasUnsavedChanges: true,
                            saveError: null,
                          }));
                          window.requestAnimationFrame(syncWritingPagination);
                        }}
                        style={{
                          width: `min(100%, ${writingPageWidthPx}px)`,
                          minHeight: `${Math.max(writingPageStridePx, writingPageCount * writingPageStridePx)}px`,
                          paddingLeft: `${writingPagePaddingXPx}px`,
                          paddingRight: `${writingPagePaddingXPx}px`,
                          paddingTop: `${writingPagePaddingTopPx}px`,
                          paddingBottom: `${writingPagePaddingBottomPx + writingPageGapPx}px`,
                        }}
                        className="relative z-[3] mx-auto text-[20px] leading-relaxed text-zinc-900 outline-none"
                      />
                    </div>
                  </div>
                  <div className="mx-auto mt-3 flex w-full max-w-[960px] gap-3 text-xs">
                    <div className="min-w-0 flex-1 border border-zinc-300 bg-white px-3 py-2 text-zinc-700">
                      <p className="font-semibold uppercase tracking-[0.09em] text-zinc-500">Resumo da secao</p>
                      <p className="mt-1 line-clamp-3">{writeSession.sectionSummary?.summary || "Sem resumo carregado."}</p>
                    </div>
                    <div className="min-w-0 flex-1 border border-zinc-300 bg-white px-3 py-2 text-zinc-700">
                      <p className="font-semibold uppercase tracking-[0.09em] text-zinc-500">Resumo global</p>
                      <p className="mt-1 line-clamp-3">{writeSession.projectSummary?.summary || "Sem resumo global carregado."}</p>
                    </div>
                  </div>
                  {writeSession.currentInstruction ? (
                    <p className="mx-auto mt-2 max-w-[960px] text-xs text-zinc-600">
                      Instrucao ativa: <span className="font-medium text-zinc-800">{writeSession.currentInstruction}</span>
                    </p>
                  ) : null}
                  {writingNotice ? <p className="mx-auto mt-3 max-w-[960px] text-sm text-emerald-700">{writingNotice}</p> : null}
                  {writingError ? <p className="mx-auto mt-2 max-w-[960px] text-sm text-rose-600">{writingError}</p> : null}
                  {writeSession.saveError ? <p className="mx-auto mt-2 max-w-[960px] text-sm text-rose-600">{writeSession.saveError}</p> : null}
                </div>
              </div>

              <div className="shrink-0 border-t border-zinc-300 bg-[#ececef] px-6 py-4">
                <div className="mx-auto w-full max-w-5xl">
                  <Composer
                    docked
                    input={writingPrompt}
                    status={writingStatus}
                    isUploadingFiles={isUploadingFiles}
                    uploadNotice={uploadNotice}
                    uploadError={uploadError}
                    onInputChange={setWritingPrompt}
                    onSend={() => void sendWritingAssist(writingPrompt)}
                    onPickFiles={handlePickFiles}
                    onFilesSelected={(files) => {
                      void handleComposerFiles(files);
                    }}
                  />
                </div>
              </div>
            </div>

            <aside
              className="relative flex h-full min-h-0 shrink-0 flex-col border-l border-zinc-300 bg-[#ececef]"
              style={{ width: isWritingWorksCollapsed ? "26px" : `${writingWorksWidthPercent}%` }}
            >
              <button
                type="button"
                onClick={() => setIsWritingWorksCollapsed((current) => !current)}
                className="flex h-10 w-full items-center justify-center border-b border-zinc-300 text-zinc-700 hover:bg-zinc-200"
                aria-label={isWritingWorksCollapsed ? "Expandir painel de obras usadas" : "Colapsar painel de obras usadas"}
                title={isWritingWorksCollapsed ? "Expandir obras usadas" : "Colapsar obras usadas"}
              >
                {isWritingWorksCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </button>

              {!isWritingWorksCollapsed ? (
                <>
                  <div className="border-b border-zinc-300 px-3 py-3">
                    <p className="text-xl font-medium text-zinc-800">Obras usadas</p>
                    <p className="mt-1 text-xs text-zinc-600">{writingWorks.length} documento(s) registrado(s)</p>
                    <div className="mt-2 flex items-center gap-2 border border-zinc-300 bg-white px-2 py-2">
                      <Search size={13} className="text-zinc-500" />
                      <input
                        value={writingWorksQuery}
                        onChange={(event) => setWritingWorksQuery(event.target.value)}
                        placeholder="Buscar obra"
                        className="w-full border-0 bg-transparent text-sm text-zinc-700 outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2">
                    {writingFilteredWorks.length ? (
                      <div className="space-y-2">
                        {writingFilteredWorks.map((work) => {
                          const statusMeta = resolveEmbeddingStatusMeta(work.embeddingStatus);
                          return (
                            <div key={work.documentId} className="border border-zinc-300 bg-white px-2 py-2">
                              <div className="flex items-start justify-between gap-2">
                                <p className="line-clamp-2 text-sm font-medium text-zinc-800">{work.title}</p>
                                <span className={`shrink-0 border px-2 py-0.5 text-[11px] font-medium ${statusMeta.className}`}>
                                  {statusMeta.label}
                                </span>
                              </div>
                              <p className="mt-1 line-clamp-2 text-xs text-zinc-600">{work.sourcePath}</p>
                              <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                                <span>doc:{work.documentId}</span>
                                <span>{formatWorkDate(work.updatedAt)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-600">
                        Nenhuma obra registrada ainda. Envie arquivos pelo compositor para alimentar o painel e o contexto da escrita.
                      </p>
                    )}
                  </div>

                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Redimensionar painel de obras usadas"
                    onMouseDown={startWritingWorksResize}
                    className="absolute left-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-zinc-400"
                  />
                </>
              ) : null}
            </aside>
          </div>
        </section>
      </div>
      ) : null}
    </main>
  );
}
