"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  AlertTriangle,
  ArrowUp,
  Baby,
  Bell,
  Bold,
  Bot,
  Blocks,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleEllipsis,
  Clock3,
  Compass,
  Copy,
  Database,
  ExternalLink,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FilePenLine,
  FileSpreadsheet,
  FileText,
  FileType2,
  FileVideoCamera,
  Folder,
  Heading1,
  Image as ImageIcon,
  Italic,
  LayoutGrid,
  Lock,
  KeyRound,
  List,
  ListOrdered,
  MessageSquarePlus,
  MessageCircle,
  Maximize2,
  Mic,
  Minimize2,
  Minus,
  LogOut,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Save,
  ScanFace,
  ScanSearch,
  Search,
  Settings,
  Shield,
  User,
  Palette,
  Volume2,
  VolumeX,
  Underline,
  Upload,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
  type StreamProgressEvent,
  type LeticiaMessage,
  type PersistedThread,
  type WriteChunkView,
  type WriteProjectGlobalSummaryView,
  type WriteProjectListItem,
  type WriteSectionSummaryView,
  type WriteSectionView,
} from "../lib/client";
import {
  buildTransientStatusFromProgressEvent,
  createInitialTransientStatus,
  getLongWaitTransientMessage,
  getNextTransientDisplayCursor,
  getTransientStageCursor,
  getTransientStageLabel,
  type ResponseTransientStage,
} from "../lib/response-status-presenter";

type ChatThread = {
  id: string;
  storageId: string | null;
  title: string;
  updatedAt: number;
  messages: LeticiaMessage[];
  documentScopeIds: number[];
};

type ChatResponsePassIndicator = {
  threadId: string;
  assistantIndex: number;
  stage: ResponseTransientStage;
  text: string;
  elapsedMs: number | null;
  startedAtMs: number;
  lastProgressAtMs: number;
  progressMenu: string[];
  progressCursor: number;
  displayCursor: number;
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
type EmbeddingStatus = "completed" | "failed" | "pending";
type IngestSingleResult = {
  documentId: number;
  sourcePath: string;
  title: string | null;
  embeddingStatus: EmbeddingStatus;
};
type ChatAttachment = {
  documentId: number;
  title: string;
  sourcePath: string;
  embeddingStatus: EmbeddingStatus;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
};
type PendingComposerFileStatus = "queued" | "uploading" | "indexing" | "completed" | "failed";
type PendingComposerFile = {
  id: string;
  file: File;
  status: PendingComposerFileStatus;
  errorMessage: string | null;
  documentId: number | null;
  sourcePath: string | null;
  title: string | null;
  embeddingStatus: EmbeddingStatus | null;
  totalChunks: number | null;
  embeddedChunks: number | null;
};
type FileVisualCategory = "pdf" | "doc" | "sheet" | "image" | "video" | "audio" | "archive" | "code" | "text" | "generic";
type FileVisualToken = {
  icon: LucideIcon;
  shortLabel: string;
  iconClassName: string;
  badgeClassName: string;
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
  embeddingStatus: EmbeddingStatus;
  createdAt: string;
  updatedAt: string;
};
type ComposerAttachmentView = {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  status: PendingComposerFileStatus;
  errorMessage: string | null;
  totalChunks: number | null;
  embeddedChunks: number | null;
};
type IdentityRuntimeQuickStatus = {
  status: string;
  runtime_enabled: boolean;
};
type DocumentLookupResponse = {
  ok: boolean;
  message?: string;
  document?: {
    id: number;
    status?: string;
    embeddingStatus?: EmbeddingStatus;
    totalChunks?: number;
    embeddedChunks?: number;
    ragReady?: boolean;
    metadata?: Record<string, unknown> | null;
  };
};
type RestrictionsPayload = {
  allow_shared_identity_memory: boolean;
  max_prompt_chars: number;
  note: string | null;
  updated_by: string | null;
  updated_at: string | null;
};
type RestrictionsApiResponse = {
  ok: boolean;
  message?: string;
  auth_required?: boolean;
  restrictions?: RestrictionsPayload;
  row?: {
    runtime_enabled: boolean;
    runtime_paused: boolean;
    runtime_state: string;
    selected_source_id: string | null;
    updated_at: string | null;
  } | null;
};
type SuperadminSettingsSectionKey =
  | "geral"
  | "notificacoes"
  | "personalizacao"
  | "aplicativos"
  | "agendamentos"
  | "controlar-dados"
  | "seguranca"
  | "controles-parentais"
  | "conta";
type SuperadminSettingsSection = {
  key: SuperadminSettingsSectionKey;
  label: string;
  icon: LucideIcon;
};
type ComposerDocumentReadiness = {
  embeddingStatus: EmbeddingStatus;
  ragReady: boolean;
  totalChunks: number;
  embeddedChunks: number;
};
type ScopedDocumentState = {
  documentId: number;
  title: string;
  embeddingStatus: EmbeddingStatus;
  ragReady: boolean;
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

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript?: string }>>;
};

type SpeechRecognitionErrorEventLike = Event & {
  error?: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognition;

const SESSION_STORAGE_KEY = "knexai_session_id";
const THREAD_CACHE_PREFIX = "knexai_threads_cache_v1";
const SUPERADMIN_KEY_STORAGE = "knexai_superadmin_key";
const SUPERADMIN_SETTINGS_SECTIONS: SuperadminSettingsSection[] = [
  { key: "geral", label: "Geral", icon: Settings },
  { key: "notificacoes", label: "Notificacoes", icon: Bell },
  { key: "personalizacao", label: "Personalizacao", icon: Palette },
  { key: "aplicativos", label: "Aplicativos", icon: Blocks },
  { key: "agendamentos", label: "Agendamentos", icon: Clock3 },
  { key: "controlar-dados", label: "Controlar dados", icon: Database },
  { key: "seguranca", label: "Seguranca", icon: Shield },
  { key: "controles-parentais", label: "Controles parentais", icon: Baby },
  { key: "conta", label: "Conta", icon: User },
];
const WRITING_NAV_MIN_WIDTH_PERCENT = 16;
const WRITING_NAV_MAX_WIDTH_PERCENT = 44;
const WRITING_NAV_DEFAULT_WIDTH_PERCENT = 24;
const WRITING_WORKS_MIN_WIDTH_PERCENT = 16;
const WRITING_WORKS_MAX_WIDTH_PERCENT = 42;
const WRITING_WORKS_DEFAULT_WIDTH_PERCENT = 22;
const CHAT_SIDEBAR_MIN_WIDTH_PX = 248;
const CHAT_SIDEBAR_MAX_WIDTH_PX = 420;
const CHAT_SIDEBAR_DEFAULT_WIDTH_PX = 300;
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

function sanitizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseBoundedInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
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

function normalizeMessageMetadata(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function normalizeEmbeddingStatus(value: unknown): EmbeddingStatus {
  if (value === "completed" || value === "failed" || value === "pending") {
    return value;
  }
  return "pending";
}

function extractMessageRagDocumentIds(message: LeticiaMessage) {
  const metadata = normalizeMessageMetadata(message.metadata);
  return normalizeDocumentScopeIds(metadata?.rag_document_ids, 64);
}

function resolveLatestThreadScopedDocumentIds(messages: LeticiaMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const ids = extractMessageRagDocumentIds(messages[index]);
    if (ids.length) return ids;
  }
  return [];
}

function extractMessageAttachments(message: LeticiaMessage): ChatAttachment[] {
  const metadata = normalizeMessageMetadata(message.metadata);
  const raw = metadata?.rag_attachments;
  if (!Array.isArray(raw)) return [];
  const attachments: ChatAttachment[] = [];
  const seen = new Set<number>();
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const item = row as Record<string, unknown>;
    const parsedId = Number(item.documentId);
    if (!Number.isFinite(parsedId)) continue;
    const documentId = Math.round(parsedId);
    if (documentId <= 0 || seen.has(documentId)) continue;
    seen.add(documentId);
    const sourcePath = typeof item.sourcePath === "string" ? item.sourcePath.trim() : "";
    const fallbackTitle = sourcePath ? normalizeWorkTitle(sourcePath, documentId) : `Documento ${documentId}`;
    const titleRaw = typeof item.title === "string" ? item.title.trim() : "";
    const title = titleRaw || fallbackTitle;
    const fileNameRaw = typeof item.fileName === "string" ? item.fileName.trim() : "";
    const fileName = fileNameRaw || title;
    const embeddingStatus = normalizeEmbeddingStatus(item.embeddingStatus);
    attachments.push({
      documentId,
      title,
      sourcePath,
      embeddingStatus,
      fileName,
      mimeType: typeof item.mimeType === "string" && item.mimeType.trim() ? item.mimeType.trim() : null,
      sizeBytes: Number.isFinite(Number(item.sizeBytes)) ? Math.max(0, Math.round(Number(item.sizeBytes))) : null,
    });
  }
  return attachments;
}

function hasFileDrag(dataTransfer: DataTransfer | null | undefined) {
  if (!dataTransfer) return false;
  if (Array.from(dataTransfer.types || []).includes("Files")) return true;
  const items = Array.from(dataTransfer.items || []);
  return items.some((item) => item.kind === "file");
}

function extractFilesFromDataTransfer(dataTransfer: DataTransfer | null | undefined) {
  if (!dataTransfer) return [] as File[];
  const fromItems = Array.from(dataTransfer.items || [])
    .map((item) => (item.kind === "file" ? item.getAsFile() : null))
    .filter((file): file is File => Boolean(file));
  if (fromItems.length) return fromItems;
  return Array.from(dataTransfer.files || []);
}

function formatSizeLabel(sizeBytes: number | null) {
  if (!Number.isFinite(sizeBytes as number) || (sizeBytes as number) <= 0) return "";
  const value = sizeBytes as number;
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(gb >= 100 ? 0 : 1)} GB`;
}

const DOC_EXTENSIONS = new Set(["doc", "docx", "odt", "rtf"]);
const SHEET_EXTENSIONS = new Set(["xls", "xlsx", "ods", "csv", "tsv"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg", "heic", "heif", "tiff", "avif"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "mkv", "m4v", "avi"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "m4a", "aac", "flac", "opus"]);
const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z", "tar", "gz", "bz2", "xz"]);
const CODE_EXTENSIONS = new Set([
  "js",
  "jsx",
  "ts",
  "tsx",
  "py",
  "java",
  "go",
  "rs",
  "c",
  "cpp",
  "h",
  "hpp",
  "cs",
  "php",
  "rb",
  "swift",
  "kt",
  "sql",
  "sh",
]);
const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown", "json", "yaml", "yml", "xml", "ini", "cfg", "log"]);

function resolveFileExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  const match = normalized.match(/\.([a-z0-9]{1,12})$/i);
  return match?.[1] ?? "";
}

function formatShortFileName(fileName: string, maxChars = 34) {
  const normalized = (fileName || "").trim() || "arquivo";
  if (normalized.length <= maxChars) return normalized;
  const extension = resolveFileExtension(normalized);
  if (!extension) return `${normalized.slice(0, Math.max(1, maxChars - 3))}...`;
  const suffix = `.${extension}`;
  const headLength = Math.max(6, maxChars - suffix.length - 3);
  return `${normalized.slice(0, headLength)}...${suffix}`;
}

function resolveFileVisualCategory(fileName: string, mimeType: string | null | undefined): FileVisualCategory {
  const extension = resolveFileExtension(fileName);
  const normalizedMime = (mimeType || "").trim().toLowerCase();

  if (normalizedMime === "application/pdf" || extension === "pdf") return "pdf";
  if (
    normalizedMime.includes("word") ||
    normalizedMime.includes("officedocument.wordprocessingml") ||
    DOC_EXTENSIONS.has(extension)
  ) {
    return "doc";
  }
  if (
    normalizedMime.includes("sheet") ||
    normalizedMime.includes("excel") ||
    normalizedMime === "text/csv" ||
    SHEET_EXTENSIONS.has(extension)
  ) {
    return "sheet";
  }
  if (normalizedMime.startsWith("image/") || IMAGE_EXTENSIONS.has(extension)) return "image";
  if (normalizedMime.startsWith("video/") || VIDEO_EXTENSIONS.has(extension)) return "video";
  if (normalizedMime.startsWith("audio/") || AUDIO_EXTENSIONS.has(extension)) return "audio";
  if (
    normalizedMime.includes("zip") ||
    normalizedMime.includes("compressed") ||
    normalizedMime.includes("tar") ||
    ARCHIVE_EXTENSIONS.has(extension)
  ) {
    return "archive";
  }
  if (
    normalizedMime.includes("javascript") ||
    normalizedMime.includes("typescript") ||
    normalizedMime.includes("json") ||
    normalizedMime.includes("xml") ||
    normalizedMime.includes("yaml") ||
    normalizedMime.includes("x-python") ||
    normalizedMime.includes("x-sh") ||
    CODE_EXTENSIONS.has(extension)
  ) {
    return "code";
  }
  if (normalizedMime.startsWith("text/") || TEXT_EXTENSIONS.has(extension)) return "text";
  return "generic";
}

function resolveFileVisualToken(fileName: string, mimeType: string | null | undefined): FileVisualToken {
  const extension = resolveFileExtension(fileName);
  const fallbackLabel = extension ? extension.slice(0, 4).toUpperCase() : "FILE";
  const category = resolveFileVisualCategory(fileName, mimeType);

  if (category === "pdf") {
    return {
      icon: FileText,
      shortLabel: "PDF",
      iconClassName: "text-red-600",
      badgeClassName: "border-red-200 bg-red-50 text-red-700",
    };
  }
  if (category === "doc") {
    return {
      icon: FileType2,
      shortLabel: "DOC",
      iconClassName: "text-blue-600",
      badgeClassName: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }
  if (category === "sheet") {
    return {
      icon: FileSpreadsheet,
      shortLabel: "XLS",
      iconClassName: "text-emerald-600",
      badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (category === "image") {
    return {
      icon: FileImage,
      shortLabel: "IMG",
      iconClassName: "text-fuchsia-600",
      badgeClassName: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
    };
  }
  if (category === "video") {
    return {
      icon: FileVideoCamera,
      shortLabel: "VID",
      iconClassName: "text-violet-600",
      badgeClassName: "border-violet-200 bg-violet-50 text-violet-700",
    };
  }
  if (category === "audio") {
    return {
      icon: FileAudio,
      shortLabel: "AUDIO",
      iconClassName: "text-amber-600",
      badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  if (category === "archive") {
    return {
      icon: FileArchive,
      shortLabel: "ZIP",
      iconClassName: "text-orange-600",
      badgeClassName: "border-orange-200 bg-orange-50 text-orange-700",
    };
  }
  if (category === "code") {
    return {
      icon: FileCode,
      shortLabel: "CODE",
      iconClassName: "text-indigo-600",
      badgeClassName: "border-indigo-200 bg-indigo-50 text-indigo-700",
    };
  }
  if (category === "text") {
    return {
      icon: FileText,
      shortLabel: "TXT",
      iconClassName: "text-sky-600",
      badgeClassName: "border-sky-200 bg-sky-50 text-sky-700",
    };
  }
  return {
    icon: FileText,
    shortLabel: fallbackLabel,
    iconClassName: "text-zinc-600",
    badgeClassName: "border-zinc-200 bg-zinc-100 text-zinc-700",
  };
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

function resolveComposerAttachmentStatusMeta(status: PendingComposerFileStatus) {
  if (status === "completed") {
    return { label: "Indexado", className: "border-emerald-300 bg-emerald-50 text-emerald-700", tone: "completed" as const };
  }
  if (status === "failed") {
    return { label: "Erro", className: "border-rose-300 bg-rose-50 text-rose-700", tone: "failed" as const };
  }
  if (status === "uploading") {
    return { label: "Enviando", className: "border-sky-300 bg-sky-50 text-sky-700", tone: "active" as const };
  }
  if (status === "indexing") {
    return { label: "RAG", className: "border-amber-300 bg-amber-50 text-amber-700", tone: "active" as const };
  }
  return { label: "Na fila", className: "border-zinc-300 bg-zinc-100 text-zinc-700", tone: "queued" as const };
}

function resolveIdentityStatusDotClass(status: string) {
  const key = `${status || ""}`.trim().toLowerCase();
  if (key === "identified") return "bg-emerald-500";
  if (key === "tracking" || key === "monitoring" || key === "validating") return "bg-sky-500";
  if (key === "conflict" || key === "degraded") return "bg-rose-500";
  if (key === "paused") return "bg-amber-500";
  return "bg-zinc-400";
}

const initialMessages: LeticiaMessage[] = [];
const INITIAL_THINKING_TEXT = "Enviando solicitacao";
const THINKING_ROTATE_INTERVAL_MS = 1400;
const THINKING_STALE_PROGRESS_MS = 2200;
const THINKING_LONG_WAIT_MS = 12000;
const WRITE_PANEL_TRANSITION_MS = 320;
const COMPOSER_INDEXING_POLL_MS = 1500;
const COMPOSER_INDEXING_ERROR_RETRY_LIMIT = 5;
const COMPOSER_INDEXING_TIMEOUT_MS = 240000;

const SIDEBAR_ACTIONS = [
  { id: "new", label: "Novo chat", icon: MessageSquarePlus },
  { id: "search", label: "Buscar em chats", icon: Search },
  { id: "images", label: "Imagens", icon: ImageIcon },
  { id: "apps", label: "Aplicativos", icon: LayoutGrid },
  { id: "research", label: "Investigacao", icon: Compass },
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

function resolveDayStart(timestamp: number) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatElapsedLabel(elapsedMs: number | null) {
  if (!Number.isFinite(elapsedMs as number) || (elapsedMs as number) < 0) return "";
  const value = Math.round(elapsedMs as number);
  if (value < 1000) return `${value}ms`;
  const seconds = value / 1000;
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = Math.round(seconds % 60);
  if (remSeconds <= 0) return `${minutes}m`;
  return `${minutes}m ${remSeconds}s`;
}

function sanitizePersistedAssistantContent(content: string) {
  return `${content || ""}`.replace(/\[\[KNX_EVT\]\][\s\S]*?\[\[\/KNX_EVT\]\]/g, "").replace(/\u0000/g, "");
}

function toModelHistory(messages: LeticiaMessage[]): LeticiaMessage[] {
  return messages.filter((message, index) => {
    if (index === 0 && message.role === "assistant" && message.content === initialMessages[0]?.content) {
      return false;
    }
    const metadata = normalizeMessageMetadata(message.metadata);
    if (metadata?.rag_attachment_notice === true) {
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

function resolveSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  const fromWindow = window as unknown as {
    SpeechRecognition?: BrowserSpeechRecognitionCtor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
  };
  return fromWindow.SpeechRecognition || fromWindow.webkitSpeechRecognition || null;
}

function toLocalThread(thread: PersistedThread): ChatThread {
  const messages =
    thread.messages.length > 0
      ? thread.messages
          .filter((message) => message.role === "user" || message.role === "assistant")
          .map((message) => ({
            role: message.role as "user" | "assistant",
            content: message.content,
            metadata: normalizeMessageMetadata(message.metadata),
          }))
      : initialMessages;
  const documentScopeFromMessages = resolveLatestThreadScopedDocumentIds(messages);
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
          ? thread.messages
              .filter(
                (message) =>
                  message &&
                  (message.role === "user" || message.role === "assistant") &&
                  typeof message.content === "string" &&
                  message.content.trim(),
              )
              .map((message) => ({
                role: message.role,
                content: message.content,
                metadata: normalizeMessageMetadata(message.metadata),
              }))
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
  speechSupported: boolean;
  isListening: boolean;
  isUploadingFiles: boolean;
  uploadNotice: string | null;
  uploadError: string | null;
  pendingAttachments: ComposerAttachmentView[];
  onInputChange: (value: string) => void;
  onSend: () => void;
  onToggleListening: () => void;
  onPickFiles: () => void;
  onFilesSelected: (files: File[]) => void;
  onRemoveAttachment: (attachmentId: string) => void;
};

function Composer({
  docked,
  input,
  status,
  speechSupported,
  isListening,
  isUploadingFiles,
  uploadNotice,
  uploadError,
  pendingAttachments,
  onInputChange,
  onSend,
  onToggleListening,
  onPickFiles,
  onFilesSelected,
  onRemoveAttachment,
}: ComposerProps) {
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragDepthRef = useRef(0);
  const hasFailedAttachments = pendingAttachments.some((attachment) => attachment.status === "failed");
  const hasActiveAttachments = pendingAttachments.some(
    (attachment) => attachment.status === "queued" || attachment.status === "uploading" || attachment.status === "indexing",
  );
  const hasCompletedAttachments = pendingAttachments.some((attachment) => attachment.status === "completed");
  const canSend =
    (input.trim().length > 0 || hasCompletedAttachments) &&
    status !== "thinking" &&
    !isUploadingFiles &&
    !hasFailedAttachments &&
    !hasActiveAttachments;

  const handleDragEnter = (event: ReactDragEvent<HTMLElement>) => {
    if (!hasFileDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  };

  const handleDragOver = (event: ReactDragEvent<HTMLElement>) => {
    if (!hasFileDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    if (!isDraggingFiles) setIsDraggingFiles(true);
  };

  const handleDragLeave = (event: ReactDragEvent<HTMLElement>) => {
    if (!isDraggingFiles) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingFiles(false);
  };

  const handleDrop = (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);
    const files = extractFilesFromDataTransfer(event.dataTransfer);
    if (!files.length) return;
    onFilesSelected(files);
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full rounded-[28px] border bg-white shadow-sm transition-colors ${docked ? "" : "max-w-3xl"} ${
        isDraggingFiles ? "border-zinc-500 ring-2 ring-zinc-300" : "border-zinc-300"
      }`}
    >
      <textarea
        className="h-16 w-full resize-none rounded-t-[28px] border-0 px-6 pt-5 text-[21px] text-zinc-900 outline-none placeholder:text-zinc-500"
        placeholder={isUploadingFiles ? "Enviando arquivo para ingestao..." : "Escreva as orientacoes para o arquivo"}
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
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
      />
      {pendingAttachments.length ? (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {pendingAttachments.map((attachment) => {
            const visual = resolveFileVisualToken(attachment.fileName, attachment.mimeType);
            const statusMeta = resolveComposerAttachmentStatusMeta(attachment.status);
            const Icon = visual.icon;
            const shortName = formatShortFileName(attachment.fileName, 38);
            const sizeLabel = formatSizeLabel(attachment.sizeBytes);
            const totalChunks = Number.isFinite(attachment.totalChunks as number) ? Math.round(attachment.totalChunks as number) : 0;
            const embeddedChunksRaw = Number.isFinite(attachment.embeddedChunks as number)
              ? Math.round(attachment.embeddedChunks as number)
              : 0;
            const embeddedChunks = Math.max(0, Math.min(embeddedChunksRaw, totalChunks > 0 ? totalChunks : embeddedChunksRaw));
            const hasChunkProgress = totalChunks > 0 && Number.isFinite(attachment.embeddedChunks as number);
            const chunksLabel = hasChunkProgress ? `${embeddedChunks}/${totalChunks} chunks` : "";
            const progressRatio = hasChunkProgress
              ? Math.max(0, Math.min(1, embeddedChunks / Math.max(1, totalChunks)))
              : statusMeta.tone === "completed"
                ? 1
                : statusMeta.tone === "failed"
                  ? 1
                  : attachment.status === "uploading"
                    ? 0.2
                    : attachment.status === "indexing"
                      ? 0.45
                      : 0.08;
            const progressDegrees = Math.round(progressRatio * 360);
            const progressColor =
              statusMeta.tone === "completed"
                ? "#059669"
                : statusMeta.tone === "failed"
                  ? "#e11d48"
                  : attachment.status === "uploading"
                    ? "#0284c7"
                    : attachment.status === "indexing"
                      ? "#d97706"
                      : "#71717a";
            const ringClassName = statusMeta.tone === "active" && !hasChunkProgress ? "animate-spin" : "";
            return (
              <div
                key={attachment.id}
                className="inline-flex max-w-full items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5"
                title={attachment.fileName}
              >
                <span className="relative inline-flex h-8 w-8 items-center justify-center">
                  <span
                    className={`pointer-events-none absolute inset-0 z-10 rounded-full ${ringClassName}`}
                    style={{
                      background: `conic-gradient(${progressColor} ${progressDegrees}deg, rgba(161,161,170,0.25) ${progressDegrees}deg 360deg)`,
                    }}
                  />
                  <span className="pointer-events-none absolute inset-[2px] z-10 rounded-full bg-zinc-50" />
                  <span className={`relative z-20 inline-flex h-7 w-7 items-center justify-center rounded-full border ${visual.badgeClassName}`}>
                    <Icon size={13} className={visual.iconClassName} />
                  </span>
                  {statusMeta.tone === "completed" ? (
                    <span className="absolute -right-1 -bottom-1 z-30 inline-flex h-4 w-4 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50">
                      <Check size={9} className="text-emerald-600" />
                    </span>
                  ) : null}
                  {statusMeta.tone === "failed" ? (
                    <span className="absolute -right-1 -bottom-1 z-30 inline-flex h-4 w-4 items-center justify-center rounded-full border border-rose-200 bg-rose-50">
                      <AlertTriangle size={9} className="text-rose-600" />
                    </span>
                  ) : null}
                </span>
                <div className="min-w-0">
                  <p className="max-w-[220px] truncate text-xs font-medium text-zinc-800">{shortName}</p>
                  {attachment.errorMessage ? (
                    <p className="max-w-[220px] truncate text-[10px] text-rose-600">{attachment.errorMessage}</p>
                  ) : chunksLabel && (attachment.status === "uploading" || attachment.status === "indexing") ? (
                    <p className="text-[10px] text-amber-700">{chunksLabel}</p>
                  ) : sizeLabel ? (
                    <p className="text-[10px] text-zinc-500">{sizeLabel}</p>
                  ) : null}
                </div>
                <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${statusMeta.className}`}>
                  {statusMeta.label}
                </span>
                <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${visual.badgeClassName}`}>{visual.shortLabel}</span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(attachment.id)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"
                  aria-label={`Remover ${attachment.fileName}`}
                  title="Remover"
                >
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

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
          <Link
            href="/knexai/proactive-assistant"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100"
            title="Abrir assistente proativo"
            aria-label="Abrir assistente proativo"
          >
            <Bot size={17} />
          </Link>
          <button
            type="button"
            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            Pensamento estendido
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleListening}
            disabled={!speechSupported || status === "thinking"}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
              isListening ? "bg-emerald-100 text-emerald-700" : "text-zinc-700 hover:bg-zinc-100"
            } disabled:cursor-not-allowed disabled:opacity-45`}
            title={
              speechSupported
                ? isListening
                  ? "Parar escuta de voz"
                  : "Ativar escuta por voz"
                : "Escuta de voz indisponivel neste navegador"
            }
            aria-label={isListening ? "Parar escuta de voz" : "Ativar escuta por voz"}
          >
            <Mic size={17} />
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </div>
      {uploadNotice ? <p className="px-4 pb-1 text-xs text-emerald-700">{uploadNotice}</p> : null}
      {uploadError ? <p className="px-4 pb-2 text-xs text-rose-600">{uploadError}</p> : null}
      {!uploadNotice && !uploadError ? (
        <p className="px-4 pb-2 text-xs text-zinc-500">
          {hasActiveAttachments
            ? "Aguarde a indexacao dos arquivos para liberar o envio."
            : hasFailedAttachments
              ? "Remova os arquivos com erro para continuar."
              : "Anexe arquivos, escreva as instrucoes e pressione Enter para enviar."}
        </p>
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
  const [composerPendingFiles, setComposerPendingFiles] = useState<PendingComposerFile[]>([]);
  const [status, setStatus] = useState<"idle" | "thinking" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isChatMode, setIsChatMode] = useState(false);
  const [activeMode, setActiveMode] = useState<WorkspaceMode>("chat");
  const [chatSidebarWidthPx, setChatSidebarWidthPx] = useState(CHAT_SIDEBAR_DEFAULT_WIDTH_PX);
  const [isChatSearchModalOpen, setIsChatSearchModalOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [isWritePanelMounted, setIsWritePanelMounted] = useState(false);
  const [isWritePanelVisible, setIsWritePanelVisible] = useState(false);
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
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageKey, setSpeakingMessageKey] = useState<string | null>(null);
  const [chatPassIndicator, setChatPassIndicator] = useState<ChatResponsePassIndicator | null>(null);
  const [identityQuickStatus, setIdentityQuickStatus] = useState<IdentityRuntimeQuickStatus>({
    status: "disabled",
    runtime_enabled: false,
  });
  const [isIdentityPanelOpen, setIsIdentityPanelOpen] = useState(false);
  const [isIdentityPanelMinimized, setIsIdentityPanelMinimized] = useState(false);
  const [isIdentityPanelMaximized, setIsIdentityPanelMaximized] = useState(false);
  const [identityPanelPosition, setIdentityPanelPosition] = useState<{ x: number; y: number } | null>(null);
  const [isUserSidebarMenuOpen, setIsUserSidebarMenuOpen] = useState(false);
  const [isSuperadminModalOpen, setIsSuperadminModalOpen] = useState(false);
  const [superadminActiveSection, setSuperadminActiveSection] = useState<SuperadminSettingsSectionKey>("geral");
  const [superadminKey, setSuperadminKey] = useState("");
  const [allowSharedIdentityMemory, setAllowSharedIdentityMemory] = useState(true);
  const [maxPromptChars, setMaxPromptChars] = useState(4800);
  const [superadminNote, setSuperadminNote] = useState("");
  const [superadminUpdatedBy, setSuperadminUpdatedBy] = useState("");
  const [superadminRuntimeState, setSuperadminRuntimeState] = useState("-");
  const [superadminUpdatedAt, setSuperadminUpdatedAt] = useState<string | null>(null);
  const [superadminAuthRequired, setSuperadminAuthRequired] = useState(false);
  const [isSuperadminLoading, setIsSuperadminLoading] = useState(false);
  const [isSuperadminSaving, setIsSuperadminSaving] = useState(false);
  const [superadminError, setSuperadminError] = useState<string | null>(null);
  const [superadminFeedback, setSuperadminFeedback] = useState<string | null>(null);
  const [isGeneralSecurityBannerVisible, setIsGeneralSecurityBannerVisible] = useState(true);
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
  const chatScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const composerDockRef = useRef<HTMLDivElement | null>(null);
  const lastAssistantBubbleRef = useRef<HTMLDivElement | null>(null);
  const writingEditorRef = useRef<HTMLDivElement | null>(null);
  const writingScrollRef = useRef<HTMLDivElement | null>(null);
  const writingPageRootRef = useRef<HTMLDivElement | null>(null);
  const writingPanelWasOpenRef = useRef(false);
  const writingWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const writingNavResizeRef = useRef<{ startX: number; startWidthPercent: number } | null>(null);
  const writingWorksResizeRef = useRef<{ startX: number; startWidthPercent: number } | null>(null);
  const chatSidebarResizeRef = useRef<{ startX: number; startWidthPx: number } | null>(null);
  const chatSearchInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const speechSeedInputRef = useRef<string>("");
  const identityPanelRootRef = useRef<HTMLDivElement | null>(null);
  const identityPanelDragRef = useRef<{ offsetX: number; offsetY: number; width: number; height: number } | null>(null);
  const userSidebarMenuRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamIdRef = useRef(0);
  const threadStoreLocksRef = useRef<Record<string, Promise<string | null>>>({});
  const pendingDeltaRef = useRef("");
  const flushFrameRef = useRef<number | null>(null);
  const writePanelUnmountTimerRef = useRef<number | null>(null);
  const composerIngestionTasksRef = useRef(new Map<string, { cancelled: boolean }>());
  const superadminAutoLoadRef = useRef(false);
  const chatAutoScrollEnabledRef = useRef(true);
  const previousChatThreadIdRef = useRef<string | null>(null);

  const activeThread = useMemo(() => threads.find((item) => item.id === activeThreadId) ?? threads[0], [activeThreadId, threads]);
  const activeMessages = activeThread?.messages ?? initialMessages;
  const writingWorksById = useMemo(() => new Map<number, WritingWork>(writingWorks.map((item) => [item.documentId, item])), [writingWorks]);
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
  const sortedThreads = useMemo(() => [...threads].sort((a, b) => b.updatedAt - a.updatedAt), [threads]);
  const filteredChatThreads = useMemo(() => {
    const query = chatSearchQuery.trim().toLowerCase();
    if (!query) return sortedThreads;
    return sortedThreads.filter((thread) => thread.title.toLowerCase().includes(query));
  }, [chatSearchQuery, sortedThreads]);
  const chatSearchThreadGroups = useMemo(() => {
    const nowStart = resolveDayStart(Date.now());
    const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const groups = new Map<string, ChatThread[]>();
    for (const thread of filteredChatThreads) {
      const safeUpdatedAt = Number.isFinite(thread.updatedAt) ? thread.updatedAt : Date.now();
      const threadStart = resolveDayStart(safeUpdatedAt);
      const diffDays = Math.floor((nowStart - threadStart) / 86_400_000);
      const label =
        diffDays <= 0 ? "Hoje" : diffDays === 1 ? "Ontem" : dateFormatter.format(new Date(safeUpdatedAt));
      const existing = groups.get(label);
      if (existing) {
        existing.push(thread);
      } else {
        groups.set(label, [thread]);
      }
    }
    return Array.from(groups.entries()).map(([label, groupedThreads]) => ({ label, threads: groupedThreads }));
  }, [filteredChatThreads]);
  const superadminRequestHeaders = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = {};
    const key = sanitizeText(superadminKey);
    if (key) {
      headers["x-superadmin-key"] = key;
    }
    return headers;
  }, [superadminKey]);
  const superadminActiveSectionMeta = useMemo(
    () => SUPERADMIN_SETTINGS_SECTIONS.find((item) => item.key === superadminActiveSection) ?? SUPERADMIN_SETTINGS_SECTIONS[0],
    [superadminActiveSection],
  );

  const loadSuperadminRestrictions = useCallback(async () => {
    setIsSuperadminLoading(true);
    setSuperadminError(null);
    setSuperadminFeedback(null);
    try {
      const response = await fetch("/api/identity/superadmin/restrictions", {
        method: "GET",
        headers: superadminRequestHeaders,
        cache: "no-store",
      });
      const payload = await parseJsonResponse<RestrictionsApiResponse>(response);
      if (!response.ok || !payload?.ok || !payload.restrictions) {
        setSuperadminAuthRequired(Boolean(payload?.auth_required));
        setSuperadminError(payload?.message || `Falha ao carregar restricoes (HTTP ${response.status}).`);
        return;
      }
      setSuperadminAuthRequired(Boolean(payload.auth_required));
      setAllowSharedIdentityMemory(Boolean(payload.restrictions.allow_shared_identity_memory));
      setMaxPromptChars(parseBoundedInt(payload.restrictions.max_prompt_chars, 4800, 600, 24000));
      setSuperadminNote(payload.restrictions.note || "");
      setSuperadminUpdatedBy(payload.restrictions.updated_by || "");
      setSuperadminRuntimeState(payload.row?.runtime_state || "-");
      setSuperadminUpdatedAt(payload.restrictions.updated_at || payload.row?.updated_at || null);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "superadmin_restrictions_load_failed";
      setSuperadminError(message);
    } finally {
      setIsSuperadminLoading(false);
    }
  }, [superadminRequestHeaders]);

  const saveSuperadminRestrictions = useCallback(async () => {
    setIsSuperadminSaving(true);
    setSuperadminError(null);
    setSuperadminFeedback(null);
    try {
      const response = await fetch("/api/identity/superadmin/restrictions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...superadminRequestHeaders,
        },
        body: JSON.stringify({
          allow_shared_identity_memory: allowSharedIdentityMemory,
          max_prompt_chars: parseBoundedInt(maxPromptChars, 4800, 600, 24000),
          note: sanitizeText(superadminNote) || null,
          updated_by: sanitizeText(superadminUpdatedBy) || null,
        }),
      });
      const payload = await parseJsonResponse<RestrictionsApiResponse>(response);
      if (!response.ok || !payload?.ok || !payload.restrictions) {
        setSuperadminAuthRequired(Boolean(payload?.auth_required));
        setSuperadminError(payload?.message || `Falha ao salvar restricoes (HTTP ${response.status}).`);
        return;
      }
      setSuperadminAuthRequired(Boolean(payload.auth_required));
      setAllowSharedIdentityMemory(Boolean(payload.restrictions.allow_shared_identity_memory));
      setMaxPromptChars(parseBoundedInt(payload.restrictions.max_prompt_chars, 4800, 600, 24000));
      setSuperadminNote(payload.restrictions.note || "");
      setSuperadminUpdatedBy(payload.restrictions.updated_by || "");
      setSuperadminRuntimeState(payload.row?.runtime_state || "-");
      setSuperadminUpdatedAt(payload.restrictions.updated_at || payload.row?.updated_at || null);
      setSuperadminFeedback("Restricoes superadmin atualizadas com sucesso.");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "superadmin_restrictions_save_failed";
      setSuperadminError(message);
    } finally {
      setIsSuperadminSaving(false);
    }
  }, [allowSharedIdentityMemory, maxPromptChars, superadminNote, superadminRequestHeaders, superadminUpdatedBy]);

  const openSuperadminModal = useCallback((section: SuperadminSettingsSectionKey = "geral") => {
    setSuperadminActiveSection(section);
    setSuperadminError(null);
    setSuperadminFeedback(null);
    setIsGeneralSecurityBannerVisible(true);
    setIsSuperadminModalOpen(true);
  }, []);

  const closeSuperadminModal = useCallback(() => {
    setIsSuperadminModalOpen(false);
  }, []);

  useEffect(() => {
    let active = true;
    const fetchIdentityQuickStatus = async () => {
      try {
        const response = await fetch("/api/identity/runtime/status", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as IdentityRuntimeQuickStatus;
        if (!active) return;
        setIdentityQuickStatus({
          status: `${payload.status || "disabled"}`.trim().toLowerCase() || "disabled",
          runtime_enabled: Boolean(payload.runtime_enabled),
        });
      } catch {
        // noop
      }
    };

    void fetchIdentityQuickStatus();
    const intervalId = window.setInterval(() => {
      void fetchIdentityQuickStatus();
    }, 5000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(SUPERADMIN_KEY_STORAGE) || "";
    if (saved.trim()) {
      setSuperadminKey(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const trimmed = sanitizeText(superadminKey);
    if (!trimmed) {
      window.localStorage.removeItem(SUPERADMIN_KEY_STORAGE);
      return;
    }
    window.localStorage.setItem(SUPERADMIN_KEY_STORAGE, trimmed);
  }, [superadminKey]);

  useEffect(() => {
    if (!isSuperadminModalOpen) return;
    if (superadminActiveSection !== "controlar-dados") return;
    if (superadminAutoLoadRef.current) return;
    superadminAutoLoadRef.current = true;
    void loadSuperadminRestrictions();
  }, [isSuperadminModalOpen, loadSuperadminRestrictions, superadminActiveSection]);

  useEffect(() => {
    if (isSuperadminModalOpen) return;
    superadminAutoLoadRef.current = false;
  }, [isSuperadminModalOpen]);

  useEffect(() => {
    if (isSuperadminModalOpen) {
      setIsUserSidebarMenuOpen(false);
    }
  }, [isSuperadminModalOpen]);

  useEffect(() => {
    if (!isUserSidebarMenuOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!userSidebarMenuRef.current) return;
      if (userSidebarMenuRef.current.contains(event.target as Node)) return;
      setIsUserSidebarMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsUserSidebarMenuOpen(false);
    };
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isUserSidebarMenuOpen]);

  const navigateFromUserSidebarMenu = useCallback((href: string) => {
    setIsUserSidebarMenuOpen(false);
    if (typeof window !== "undefined") {
      window.location.assign(href);
    }
  }, []);

  const openSuperadminFromUserSidebarMenu = useCallback(
    (section: SuperadminSettingsSectionKey = "geral") => {
      setIsUserSidebarMenuOpen(false);
      openSuperadminModal(section);
    },
    [openSuperadminModal],
  );

  const openChatSearchModal = useCallback(() => {
    setChatSearchQuery("");
    setIsChatSearchModalOpen(true);
  }, []);

  const closeChatSearchModal = useCallback(() => {
    setIsChatSearchModalOpen(false);
    setChatSearchQuery("");
  }, []);

  useEffect(() => {
    if (!isChatSearchModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeChatSearchModal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.requestAnimationFrame(() => {
      chatSearchInputRef.current?.focus();
    });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeChatSearchModal, isChatSearchModalOpen]);

  useEffect(() => {
    if (!isSuperadminModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSuperadminModal();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeSuperadminModal, isSuperadminModalOpen]);

  const openIdentityPanel = () => {
    setIsIdentityPanelOpen(true);
    setIsIdentityPanelMinimized(false);
    setIdentityPanelPosition(null);
  };

  const minimizeIdentityPanel = () => {
    setIsIdentityPanelMinimized(true);
    setIsIdentityPanelMaximized(false);
  };

  const toggleIdentityPanelMaximized = () => {
    setIsIdentityPanelMinimized(false);
    setIsIdentityPanelMaximized((current) => !current);
  };

  const popoutIdentityPanel = () => {
    if (typeof window === "undefined") return;
    const width = 1280;
    const height = 820;
    const left = Math.max(0, window.screenX + Math.round((window.outerWidth - width) / 2));
    const top = Math.max(0, window.screenY + Math.round((window.outerHeight - height) / 2));
    const features = [
      "popup=yes",
      "resizable=yes",
      "scrollbars=yes",
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
    ].join(",");
    const popup = window.open("/knexai/identity-runtime", "knexai-identity-panel-window", features);
    if (popup) {
      popup.focus();
      closeIdentityPanel();
    } else {
      setError("Nao foi possivel abrir janela separada. Verifique bloqueio de pop-up no navegador.");
    }
  };

  const clampIdentityPanelPosition = (x: number, y: number, width: number, height: number) => {
    if (typeof window === "undefined") return { x, y };
    const margin = 8;
    const maxX = Math.max(margin, window.innerWidth - width - margin);
    const maxY = Math.max(margin, window.innerHeight - height - margin);
    return {
      x: Math.min(Math.max(margin, x), maxX),
      y: Math.min(Math.max(margin, y), maxY),
    };
  };

  const startIdentityPanelDrag = (event: ReactMouseEvent<HTMLElement>) => {
    if (isIdentityPanelMaximized) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button")) return;
    const panelEl = identityPanelRootRef.current;
    if (!panelEl) return;

    const rect = panelEl.getBoundingClientRect();
    const baseX = identityPanelPosition?.x ?? rect.left;
    const baseY = identityPanelPosition?.y ?? rect.top;
    const offsetX = event.clientX - baseX;
    const offsetY = event.clientY - baseY;
    identityPanelDragRef.current = {
      offsetX,
      offsetY,
      width: rect.width,
      height: rect.height,
    };
    setIdentityPanelPosition(clampIdentityPanelPosition(baseX, baseY, rect.width, rect.height));

    const onMouseMove = (moveEvent: MouseEvent) => {
      const drag = identityPanelDragRef.current;
      if (!drag) return;
      const nextX = moveEvent.clientX - drag.offsetX;
      const nextY = moveEvent.clientY - drag.offsetY;
      const clamped = clampIdentityPanelPosition(nextX, nextY, drag.width, drag.height);
      setIdentityPanelPosition(clamped);
    };

    const onMouseUp = () => {
      identityPanelDragRef.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.userSelect = "";
    };

    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    event.preventDefault();
  };

  const closeIdentityPanel = () => {
    setIsIdentityPanelOpen(false);
    setIsIdentityPanelMinimized(false);
    setIsIdentityPanelMaximized(false);
    setIdentityPanelPosition(null);
  };

  const stopListening = () => {
    const recognition = speechRecognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      // noop
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    const SpeechRecognitionCtor = resolveSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      setError("Escuta por voz nao suportada neste navegador.");
      return;
    }

    if (isListening) {
      stopListening();
      return;
    }

    const recognition = speechRecognitionRef.current || new SpeechRecognitionCtor();
    speechRecognitionRef.current = recognition;
    speechSeedInputRef.current = input.trim();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result || result.length <= 0) continue;
        const candidate = `${result[0]?.transcript || ""}`.trim();
        if (!candidate) continue;
        transcript = transcript ? `${transcript} ${candidate}` : candidate;
      }
      const nextInput = speechSeedInputRef.current
        ? `${speechSeedInputRef.current} ${transcript}`.trim()
        : transcript.trim();
      if (!nextInput) return;
      setInput(nextInput);
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      const reason = `${event.error || ""}`.trim();
      setError(reason ? `Falha na escuta por voz (${reason}).` : "Falha na escuta por voz.");
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
      setError(null);
      setIsListening(true);
    } catch {
      setIsListening(false);
      setError("Nao foi possivel iniciar a escuta por voz neste navegador.");
    }
  };

  const speakAssistantMessage = (text: string, messageKey: string) => {
    const safeText = `${text || ""}`.trim();
    if (!safeText) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setError("Leitura em voz nao suportada neste navegador.");
      return;
    }

    const synth = window.speechSynthesis;
    if (isSpeaking && speakingMessageKey === messageKey) {
      synth.cancel();
      setIsSpeaking(false);
      setSpeakingMessageKey(null);
      return;
    }

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(safeText);
    utterance.lang = "pt-BR";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeakingMessageKey((current) => (current === messageKey ? null : current));
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeakingMessageKey(null);
      setError("Falha na leitura em voz da resposta.");
    };
    setIsSpeaking(true);
    setSpeakingMessageKey(messageKey);
    synth.speak(utterance);
  };

  useEffect(() => {
    setIsSpeechSupported(Boolean(resolveSpeechRecognitionCtor()));
    return () => {
      try {
        speechRecognitionRef.current?.abort();
      } catch {
        // noop
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      document.body.style.userSelect = "";
    };
  }, []);

  useEffect(() => {
    setWriteSession((current) => (current.activeMode === activeMode ? current : { ...current, activeMode }));
  }, [activeMode]);

  useEffect(() => {
    if (writePanelUnmountTimerRef.current !== null) {
      window.clearTimeout(writePanelUnmountTimerRef.current);
      writePanelUnmountTimerRef.current = null;
    }

    if (activeMode === "write") {
      setIsWritePanelMounted(true);
      window.requestAnimationFrame(() => {
        setIsWritePanelVisible(true);
      });
      return;
    }

    setIsWritePanelVisible(false);
    writePanelUnmountTimerRef.current = window.setTimeout(() => {
      setIsWritePanelMounted(false);
      writePanelUnmountTimerRef.current = null;
    }, WRITE_PANEL_TRANSITION_MS);
  }, [activeMode]);

  useEffect(() => {
    return () => {
      if (writePanelUnmountTimerRef.current !== null) {
        window.clearTimeout(writePanelUnmountTimerRef.current);
        writePanelUnmountTimerRef.current = null;
      }
    };
  }, []);

  const scrollChatToEnd = useCallback(
    (force = false) => {
      if (!showChat) return;
      if (!force && !chatAutoScrollEnabledRef.current) return;
      const container = chatScrollContainerRef.current;
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: status === "thinking" ? "auto" : "smooth",
        });
        return;
      }
      endRef.current?.scrollIntoView({
        behavior: status === "thinking" ? "auto" : "smooth",
        block: "end",
        inline: "nearest",
      });
    },
    [showChat, status],
  );

  const handleChatScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    chatAutoScrollEnabledRef.current = distanceToBottom <= 24;
  }, []);

  useEffect(() => {
    const currentThreadId = activeThread?.id ?? null;
    if (previousChatThreadIdRef.current !== currentThreadId) {
      previousChatThreadIdRef.current = currentThreadId;
      chatAutoScrollEnabledRef.current = true;
      window.requestAnimationFrame(() => {
        scrollChatToEnd(true);
      });
      return;
    }
    scrollChatToEnd(false);
  }, [activeMessages, activeThread?.id, showChat, status, composerReservePx, scrollChatToEnd]);

  useEffect(() => {
    if (status !== "thinking") return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (!isSpeaking) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setSpeakingMessageKey(null);
  }, [status, isSpeaking]);

  useEffect(() => {
    const bubble = lastAssistantBubbleRef.current;
    if (!bubble) return;
    if (status === "thinking" || bubble.scrollHeight > bubble.clientHeight) {
      bubble.scrollTop = bubble.scrollHeight;
    }
  }, [activeMessages, status]);

  useEffect(() => {
    if (status !== "thinking") return;
    if (!chatPassIndicator) return;
    const activeThreadForIndicator = activeThread?.id || "";
    if (!activeThreadForIndicator || chatPassIndicator.threadId !== activeThreadForIndicator) return;

    const intervalId = window.setInterval(() => {
      setChatPassIndicator((current) => {
        if (!current) return current;
        if (current.threadId !== activeThreadForIndicator) return current;
        const now = Date.now();
        const elapsedMs = now - current.startedAtMs;
        const staleMs = now - current.lastProgressAtMs;
        if (staleMs < THINKING_STALE_PROGRESS_MS) {
          return {
            ...current,
            elapsedMs,
          };
        }
        if (elapsedMs >= THINKING_LONG_WAIT_MS) {
          return {
            ...current,
            elapsedMs,
            text: getLongWaitTransientMessage(elapsedMs),
          };
        }
        const rotated = getNextTransientDisplayCursor(current.displayCursor);
        const nextText = rotated.text || current.text;
        return {
          ...current,
          elapsedMs,
          displayCursor: rotated.cursor,
          text: nextText,
        };
      });
    }, THINKING_ROTATE_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [status, chatPassIndicator?.threadId, activeThread?.id]);

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
      const sidebarState = chatSidebarResizeRef.current;
      if (sidebarState) {
        const deltaX = event.clientX - sidebarState.startX;
        const nextWidth = clampNumber(
          sidebarState.startWidthPx + deltaX,
          CHAT_SIDEBAR_MIN_WIDTH_PX,
          CHAT_SIDEBAR_MAX_WIDTH_PX,
        );
        setChatSidebarWidthPx(nextWidth);
      }

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
      chatSidebarResizeRef.current = null;
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
            const existingScope = resolveLatestThreadScopedDocumentIds(existing.messages);
            return {
              ...thread,
              documentScopeIds: existingScope.length ? existingScope : thread.documentScopeIds,
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
    const safeContent = role === "assistant" ? sanitizePersistedAssistantContent(content) : content;
    if (!sessionId || !threadId || !safeContent.trim()) return;
    try {
      await savePersistedMessage({ sessionId, threadId, role, content: safeContent, metadata });
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
    return {
      ...payload.result,
      embeddingStatus: normalizeEmbeddingStatus(payload.result.embeddingStatus),
    };
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

  const buildPendingComposerFileId = (file: File) =>
    `${file.name.trim().toLowerCase()}::${file.size}::${file.lastModified}::${(file.type || "").toLowerCase()}`;

  const updateComposerPendingFile = (
    attachmentId: string,
    mutator: (current: PendingComposerFile) => PendingComposerFile,
  ) => {
    setComposerPendingFiles((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (item.id !== attachmentId) return item;
        changed = true;
        return mutator(item);
      });
      return changed ? next : prev;
    });
  };

  const fetchComposerDocumentReadiness = async (documentId: number): Promise<ComposerDocumentReadiness> => {
    const response = await fetch(`/api/documents/${documentId}?limit=1&offset=0`, { method: "GET" });
    const payload = await parseJsonResponse<DocumentLookupResponse>(response);
    if (!response.ok || !payload?.ok || !payload.document) {
      throw new Error(payload?.message || `Falha ao consultar indexacao do documento ${documentId}.`);
    }
    const document = payload.document;
    const metadata = payload.document.metadata;
    const bag = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : {};
    const embeddingStatus = normalizeEmbeddingStatus(document.embeddingStatus ?? bag.embedding_status ?? bag.embeddingStatus);
    const totalChunks = Number.isFinite(Number(document.totalChunks)) ? Math.max(0, Math.round(Number(document.totalChunks))) : 0;
    const embeddedChunks = Number.isFinite(Number(document.embeddedChunks)) ? Math.max(0, Math.round(Number(document.embeddedChunks))) : 0;
    const totalChunksFromMetadata = Number.isFinite(Number(bag.total_chunks ?? bag.totalChunks))
      ? Math.max(0, Math.round(Number(bag.total_chunks ?? bag.totalChunks)))
      : 0;
    const embeddedChunksFromMetadata = Number.isFinite(Number(bag.embedded_chunks ?? bag.embeddedChunks))
      ? Math.max(0, Math.round(Number(bag.embedded_chunks ?? bag.embeddedChunks)))
      : 0;
    const effectiveTotalChunks = Math.max(totalChunks, totalChunksFromMetadata);
    const effectiveEmbeddedChunks = Math.max(embeddedChunks, embeddedChunksFromMetadata);
    const pendingChunks = Number.isFinite(Number(bag.pending_chunks ?? bag.pendingChunks))
      ? Math.max(0, Math.round(Number(bag.pending_chunks ?? bag.pendingChunks)))
      : null;
    const failedChunks = Number.isFinite(Number(bag.failed_chunks ?? bag.failedChunks))
      ? Math.max(0, Math.round(Number(bag.failed_chunks ?? bag.failedChunks)))
      : null;
    const status = typeof document.status === "string" ? document.status.trim().toLowerCase() : "";
    const hasChunkInventory = effectiveTotalChunks > 0;
    const ragReadyFromCounts =
      status === "processed" &&
      embeddingStatus === "completed" &&
      hasChunkInventory &&
      effectiveEmbeddedChunks >= effectiveTotalChunks;
    const ragReadyFromMetadata =
      status === "processed" &&
      embeddingStatus === "completed" &&
      hasChunkInventory &&
      (pendingChunks === 0 || pendingChunks === null) &&
      (failedChunks === 0 || failedChunks === null);
    return {
      embeddingStatus,
      ragReady: Boolean(document.ragReady) || ragReadyFromCounts || ragReadyFromMetadata,
      totalChunks: effectiveTotalChunks,
      embeddedChunks: effectiveEmbeddedChunks,
    };
  };

  const resolveScopedDocumentStates = async (documentIds: number[]) => {
    const normalized = normalizeDocumentScopeIds(documentIds);
    if (!normalized.length) {
      return {
        readyIds: [] as number[],
        pending: [] as ScopedDocumentState[],
        failed: [] as ScopedDocumentState[],
      };
    }

    const states = await Promise.all(
      normalized.map(async (documentId): Promise<ScopedDocumentState> => {
        const known = writingWorksById.get(documentId);
        const title = known?.title?.trim() || `doc:${documentId}`;
        try {
          const readiness = await fetchComposerDocumentReadiness(documentId);
          return {
            documentId,
            title,
            embeddingStatus: readiness.embeddingStatus,
            ragReady: readiness.ragReady,
          };
        } catch {
          return {
            documentId,
            title,
            embeddingStatus: known?.embeddingStatus || "pending",
            ragReady: false,
          };
        }
      }),
    );

    const failed = states.filter((item) => item.embeddingStatus === "failed");
    const pending = states.filter((item) => item.embeddingStatus !== "failed" && !item.ragReady);
    const readyIds = normalizeDocumentScopeIds(
      states
        .filter((item) => item.ragReady && item.embeddingStatus === "completed")
        .map((item) => item.documentId),
    );
    return { readyIds, pending, failed };
  };

  const waitForComposerEmbeddingStatus = async (
    documentId: number,
    taskToken: { cancelled: boolean },
    onTick?: (readiness: ComposerDocumentReadiness) => void,
  ): Promise<EmbeddingStatus> => {
    let consecutiveErrors = 0;
    const startedAt = Date.now();
    while (!taskToken.cancelled) {
      if (Date.now() - startedAt >= COMPOSER_INDEXING_TIMEOUT_MS) {
        throw new Error(`Tempo limite excedido na indexacao do documento ${documentId}.`);
      }
      try {
        const readiness = await fetchComposerDocumentReadiness(documentId);
        consecutiveErrors = 0;
        onTick?.(readiness);
        if (readiness.embeddingStatus === "failed") return "failed";
        if (readiness.ragReady) return "completed";
      } catch (pollError: unknown) {
        consecutiveErrors += 1;
        if (consecutiveErrors >= COMPOSER_INDEXING_ERROR_RETRY_LIMIT) {
          if (pollError instanceof Error) throw pollError;
          throw new Error(`Falha ao acompanhar indexacao do documento ${documentId}.`);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, COMPOSER_INDEXING_POLL_MS));
    }
    return "pending";
  };

  const ingestAndTrackComposerFile = async (entry: PendingComposerFile) => {
    const taskToken = { cancelled: false };
    composerIngestionTasksRef.current.set(entry.id, taskToken);
    updateComposerPendingFile(entry.id, (current) => ({
      ...current,
      status: "uploading",
      errorMessage: null,
      embeddingStatus: null,
      totalChunks: null,
      embeddedChunks: null,
    }));

    try {
      const result = await ingestFile(entry.file);
      if (taskToken.cancelled) return;

      const normalizedTitle = (result.title || "").trim() || normalizeWorkTitle(result.sourcePath, result.documentId);
      const initialStatus = normalizeEmbeddingStatus(result.embeddingStatus);
      registerIngestedWorks([
        {
          ...result,
          title: normalizedTitle,
          embeddingStatus: initialStatus,
        },
      ]);

      updateComposerPendingFile(entry.id, (current) => ({
        ...current,
        status: initialStatus === "failed" ? "failed" : "indexing",
        errorMessage:
          initialStatus === "failed" ? `Falha ao indexar "${entry.file.name || "arquivo"}".` : null,
        documentId: result.documentId,
        sourcePath: result.sourcePath,
        title: normalizedTitle,
        embeddingStatus: initialStatus,
        totalChunks: null,
        embeddedChunks: null,
      }));

      if (initialStatus === "failed") return;

      const polledStatus = await waitForComposerEmbeddingStatus(result.documentId, taskToken, (readiness) => {
        updateComposerPendingFile(entry.id, (current) => ({
          ...current,
          totalChunks: readiness.totalChunks > 0 ? readiness.totalChunks : current.totalChunks,
          embeddedChunks:
            readiness.totalChunks > 0 ? Math.max(0, Math.min(readiness.embeddedChunks, readiness.totalChunks)) : current.embeddedChunks,
          status: readiness.ragReady ? "completed" : readiness.embeddingStatus === "failed" ? "failed" : "indexing",
          embeddingStatus: readiness.ragReady ? "completed" : readiness.embeddingStatus,
        }));
      });
      if (taskToken.cancelled) return;

      updateComposerPendingFile(entry.id, (current) => ({
        ...current,
        status: polledStatus === "completed" ? "completed" : polledStatus === "failed" ? "failed" : "indexing",
        errorMessage: polledStatus === "failed" ? `Falha ao indexar "${entry.file.name || "arquivo"}".` : null,
        embeddingStatus: polledStatus,
        embeddedChunks: polledStatus === "completed" ? current.totalChunks ?? current.embeddedChunks : current.embeddedChunks,
      }));

      registerIngestedWorks([
        {
          ...result,
          title: normalizedTitle,
          embeddingStatus: polledStatus,
        },
      ]);
    } catch (ingestError: unknown) {
      if (taskToken.cancelled) return;
      const message = ingestError instanceof Error ? ingestError.message : "";
      const base = `Falha ao processar "${entry.file.name || "arquivo"}" para indexacao.`;
      const composed = message ? `${base} ${message}` : base;
      updateComposerPendingFile(entry.id, (current) => ({
        ...current,
        status: "failed",
        errorMessage: composed,
        embeddingStatus: "failed",
        totalChunks: current.totalChunks,
        embeddedChunks: current.embeddedChunks,
      }));
    } finally {
      composerIngestionTasksRef.current.delete(entry.id);
    }
  };

  const queueComposerFiles = (files: File[]) => {
    const validFiles = files.filter((file) => file && file.size > 0);
    if (!validFiles.length) return;
    const queuedEntries: PendingComposerFile[] = [];
    setComposerPendingFiles((prev) => {
      const next = [...prev];
      const seen = new Set(prev.map((entry) => entry.id));
      for (const file of validFiles) {
        const id = buildPendingComposerFileId(file);
        if (seen.has(id)) continue;
        seen.add(id);
        const entry: PendingComposerFile = {
          id,
          file,
          status: "queued",
          errorMessage: null,
          documentId: null,
          sourcePath: null,
          title: null,
          embeddingStatus: null,
          totalChunks: null,
          embeddedChunks: null,
        };
        next.push(entry);
        queuedEntries.push(entry);
      }
      return next;
    });
    if (!queuedEntries.length) return;
    setUploadError(null);
    for (const entry of queuedEntries) {
      void ingestAndTrackComposerFile(entry);
    }
  };

  const removeComposerPendingFile = (attachmentId: string) => {
    const token = composerIngestionTasksRef.current.get(attachmentId);
    if (token) {
      token.cancelled = true;
      composerIngestionTasksRef.current.delete(attachmentId);
    }
    setComposerPendingFiles((prev) => prev.filter((item) => item.id !== attachmentId));
  };

  const clearComposerPendingFiles = () => {
    for (const token of composerIngestionTasksRef.current.values()) {
      token.cancelled = true;
    }
    composerIngestionTasksRef.current.clear();
    setComposerPendingFiles([]);
  };

  const composerPendingAttachmentViews = useMemo(
    () =>
      composerPendingFiles.map((item) => ({
        id: item.id,
        fileName: item.file.name || "arquivo",
        mimeType: item.file.type || null,
        sizeBytes: Number.isFinite(item.file.size) ? Math.max(0, Math.round(item.file.size)) : null,
        status: item.status,
        errorMessage: item.errorMessage,
        totalChunks: item.totalChunks,
        embeddedChunks: item.embeddedChunks,
      })),
    [composerPendingFiles],
  );

  useEffect(() => {
    if (activeMode !== "chat") return;
    if (!composerPendingFiles.length) {
      setUploadNotice(null);
      setUploadError(null);
      return;
    }

    const failed = composerPendingFiles.filter((item) => item.status === "failed");
    if (failed.length) {
      const failedNames = failed
        .map((item) => `"${item.file.name || "arquivo"}"`)
        .slice(0, 4)
        .join(", ");
      const suffix = failed.length > 4 ? ` e mais ${failed.length - 4}` : "";
      setUploadError(`Falha na indexacao do(s) arquivo(s): ${failedNames}${suffix}.`);
      setUploadNotice(null);
      return;
    }

    const active = composerPendingFiles.filter(
      (item) => item.status === "queued" || item.status === "uploading" || item.status === "indexing",
    );
    if (active.length) {
      setUploadNotice(
        active.length === 1
          ? `Processando embeddings e RAG de "${active[0].file.name || "arquivo"}"...`
          : `${active.length} arquivo(s) em processamento de embeddings e RAG...`,
      );
      setUploadError(null);
      return;
    }

    const completed = composerPendingFiles.filter((item) => item.status === "completed").length;
    if (completed > 0) {
      setUploadNotice(
        completed === 1
          ? "Arquivo pronto para uso no RAG e envio."
          : `${completed} arquivo(s) pronto(s) para uso no RAG e envio.`,
      );
      setUploadError(null);
      return;
    }

    setUploadNotice(null);
    setUploadError(null);
  }, [activeMode, composerPendingFiles]);

  useEffect(
    () => () => {
      for (const token of composerIngestionTasksRef.current.values()) {
        token.cancelled = true;
      }
      composerIngestionTasksRef.current.clear();
    },
    [],
  );

  const ingestComposerFileBatch = async (files: File[]) => {
    const validFiles = files.filter((file) => file && file.size > 0);
    if (!validFiles.length) {
      return {
        results: [] as IngestSingleResult[],
        attachments: [] as ChatAttachment[],
        noticeBase: "",
        noticeEmbeddings: "",
      };
    }
    const results: IngestSingleResult[] = [];
    const attachments: ChatAttachment[] = [];
    for (const file of validFiles) {
      const result = await ingestFile(file);
      results.push(result);
      const title = (result.title || "").trim() || normalizeWorkTitle(result.sourcePath, result.documentId);
      attachments.push({
        documentId: result.documentId,
        title,
        sourcePath: result.sourcePath,
        embeddingStatus: result.embeddingStatus,
        fileName: file.name || title,
        mimeType: file.type || null,
        sizeBytes: Number.isFinite(file.size) ? Math.max(0, Math.round(file.size)) : null,
      });
    }
    registerIngestedWorks(results);
    const pendingEmbeddings = results.filter((result) => result.embeddingStatus === "pending").length;
    const completedEmbeddings = results.filter((result) => result.embeddingStatus === "completed").length;
    const noticeBase = `${results.length} arquivo(s) enviado(s) para ingestao no RAG.`;
    const noticeEmbeddings =
      pendingEmbeddings > 0
        ? ` ${pendingEmbeddings} em processamento de embeddings.`
        : completedEmbeddings > 0
          ? " Embeddings concluidos."
          : "";
    return {
      results,
      attachments,
      noticeBase,
      noticeEmbeddings,
    };
  };

  const handleComposerFiles = async (files: File[]) => {
    const validFiles = files.filter((file) => file && file.size > 0);
    if (!validFiles.length || isUploadingFiles) return;

    setUploadNotice(null);
    setUploadError(null);
    setIsUploadingFiles(true);
    try {
      const ingestion = await ingestComposerFileBatch(validFiles);
      if (!ingestion.results.length) return;
      const scopeLabel = activeMode === "chat" ? "deste chat" : "do contexto RAG";
      setUploadNotice(`${ingestion.noticeBase}${ingestion.noticeEmbeddings} Arquivo(s) anexado(s) ao contexto ${scopeLabel}.`);
      setUploadError(null);
    } catch (ingestError: unknown) {
      const message = ingestError instanceof Error ? ingestError.message : "Falha ao enviar arquivo para ingestao.";
      setUploadError(message);
      setUploadNotice(null);
    } finally {
      setIsUploadingFiles(false);
    }
  };

  const handleComposerFilesForCurrentMode = (files: File[]) => {
    if (activeMode === "chat") {
      queueComposerFiles(files);
      return;
    }
    void handleComposerFiles(files);
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

  const startChatSidebarResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    chatSidebarResizeRef.current = {
      startX: event.clientX,
      startWidthPx: chatSidebarWidthPx,
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
        .map((work, index) => `${index + 1}. ${work.title} | disponibilidade:${work.embeddingStatus}`)
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
    clearComposerPendingFiles();
    setError(null);
    setStatus("idle");
    setChatPassIndicator(null);
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
    clearComposerPendingFiles();
    setError(null);
    if (chatPassIndicator && chatPassIndicator.threadId !== threadId) {
      setChatPassIndicator(null);
    }
    setIsChatMode(target.messages.some((msg) => msg.role === "user"));
  };

  const openThreadFromSearchModal = (threadId: string) => {
    openThread(threadId);
    closeChatSearchModal();
  };

  const createNewChatFromSearchModal = () => {
    createNewChat();
    closeChatSearchModal();
  };

  const handleSidebarAction = (actionId: string) => {
    if (actionId === "new") {
      createNewChat();
      return;
    }
    if (actionId === "search") {
      openChatSearchModal();
      return;
    }
  };

  const send = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (status === "thinking" || !activeThread || isUploadingFiles) return;
    if (isListening) {
      stopListening();
    }

    const formatAttachmentNames = (items: PendingComposerFile[]) => {
      const names = items
        .map((item) => `"${item.file.name || "arquivo"}"`)
        .slice(0, 4)
        .join(", ");
      const suffix = items.length > 4 ? ` e mais ${items.length - 4}` : "";
      return `${names}${suffix}`;
    };

    const failedEntries = composerPendingFiles.filter((entry) => entry.status === "failed");
    if (failedEntries.length) {
      setUploadError(`Falha na indexacao do(s) arquivo(s): ${formatAttachmentNames(failedEntries)}.`);
      setUploadNotice(null);
      return;
    }

    const inFlightEntries = composerPendingFiles.filter(
      (entry) => entry.status === "queued" || entry.status === "uploading" || entry.status === "indexing",
    );
    if (inFlightEntries.length) {
      setUploadError(`Aguarde a indexacao concluir para enviar: ${formatAttachmentNames(inFlightEntries)}.`);
      setUploadNotice(null);
      return;
    }

    const completedEntries = composerPendingFiles.filter((entry) => entry.status === "completed");
    const invalidCompletedEntries = completedEntries.filter(
      (entry) => !entry.documentId || !entry.sourcePath || !entry.title,
    );
    if (invalidCompletedEntries.length) {
      setUploadError(`Arquivo(s) sem vinculo de documento indexado: ${formatAttachmentNames(invalidCompletedEntries)}.`);
      setUploadNotice(null);
      return;
    }

    const uploadedAttachments: ChatAttachment[] = completedEntries.map((entry) => ({
      documentId: entry.documentId as number,
      title: (entry.title || "").trim() || normalizeWorkTitle(entry.sourcePath || "", entry.documentId as number),
      sourcePath: entry.sourcePath || "",
      embeddingStatus: normalizeEmbeddingStatus(entry.embeddingStatus),
      fileName: entry.file.name || "arquivo",
      mimeType: entry.file.type || null,
      sizeBytes: Number.isFinite(entry.file.size) ? Math.max(0, Math.round(entry.file.size)) : null,
    }));
    const uploadedDocumentIds = normalizeDocumentScopeIds(uploadedAttachments.map((item) => item.documentId));

    if (!trimmed && !uploadedAttachments.length) return;

    setIsChatMode(true);
    const titleSeed = trimmed || uploadedAttachments[0]?.fileName || "Novo chat";
    const nextTitle = activeThread.title === "Novo chat" ? makeThreadTitle(titleSeed) : activeThread.title;
    const previousScopeDocumentIds = activeThread.documentScopeIds.length
      ? activeThread.documentScopeIds
      : resolveLatestThreadScopedDocumentIds(activeThread.messages);
    const requestedScopeDocumentIds = normalizeDocumentScopeIds(
      uploadedDocumentIds.length ? uploadedDocumentIds : previousScopeDocumentIds,
    );
    const scopedState = await resolveScopedDocumentStates(requestedScopeDocumentIds);
    const formatScopedLabels = (items: ScopedDocumentState[]) => {
      const labels = items
        .map((item) => `"${item.title}"`)
        .slice(0, 4)
        .join(", ");
      const suffix = items.length > 4 ? ` e mais ${items.length - 4}` : "";
      return `${labels}${suffix}`;
    };
    if (scopedState.failed.length) {
      setUploadError(`Falha na indexacao do(s) documento(s) do escopo: ${formatScopedLabels(scopedState.failed)}.`);
      setUploadNotice(null);
      return;
    }
    if (scopedState.pending.length) {
      setUploadError(`Aguarde a indexacao concluir para: ${formatScopedLabels(scopedState.pending)}.`);
      setUploadNotice(null);
      return;
    }
    const scopedDocumentIds = scopedState.readyIds;
    if (uploadedAttachments.length) {
      clearComposerPendingFiles();
      setUploadError(null);
    }
    const isAttachmentOnlyMessage = !trimmed && uploadedAttachments.length > 0;
    const userMessageContent = trimmed || (uploadedAttachments.length === 1 ? "Arquivo anexado." : `${uploadedAttachments.length} arquivos anexados.`);
    const userMsgMetadata: Record<string, unknown> = {};
    if (scopedDocumentIds.length) userMsgMetadata.rag_document_ids = scopedDocumentIds;
    if (uploadedAttachments.length) userMsgMetadata.rag_attachments = uploadedAttachments;
    if (isAttachmentOnlyMessage) userMsgMetadata.rag_attachment_notice = true;
    const safeUserMetadata = Object.keys(userMsgMetadata).length ? userMsgMetadata : undefined;
    const userMsg: LeticiaMessage = { role: "user", content: userMessageContent, metadata: safeUserMetadata };

    if (isAttachmentOnlyMessage) {
      setThreads((prev) =>
        prev.map((thread) => {
          if (thread.id !== activeThread.id) return thread;
          return {
            ...thread,
            title: nextTitle,
            updatedAt: Date.now(),
            messages: [...thread.messages, userMsg],
            documentScopeIds: scopedDocumentIds,
          };
        }),
      );
      setInput("");
      setError(null);
      setStatus("idle");
      setChatPassIndicator(null);
      let storedThreadId = activeThread.storageId;
      if (!storedThreadId) {
        storedThreadId = await ensureThreadStored({ ...activeThread, title: nextTitle }, nextTitle);
      }
      void persistMessage(storedThreadId, "user", userMessageContent, safeUserMetadata);
      return;
    }

    const historyForUi = [...activeThread.messages, userMsg];
    const assistantIndex = historyForUi.length;
    const historyForModel = [...toModelHistory(activeThread.messages), userMsg];

    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.id !== activeThread.id) return thread;
        return {
          ...thread,
          title: nextTitle,
          updatedAt: Date.now(),
          messages: [...historyForUi, { role: "assistant", content: "" }],
          documentScopeIds: scopedDocumentIds,
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
    const startedAtMs = Date.now();
    const initialTransientStatus = createInitialTransientStatus();
    const composingStageCursor = getTransientStageCursor("composing");
    const finalizingStageCursor = getTransientStageCursor("finalizing");
    const composingStageLabel = getTransientStageLabel("composing");
    const finalizingStageLabel = getTransientStageLabel("finalizing");
    setChatPassIndicator({
      threadId: targetThreadId,
      assistantIndex,
      stage: initialTransientStatus.stage,
      text: initialTransientStatus.text,
      elapsedMs: null,
      startedAtMs,
      lastProgressAtMs: startedAtMs,
      progressMenu: initialTransientStatus.progressMenu,
      progressCursor: initialTransientStatus.progressCursor,
      displayCursor: initialTransientStatus.progressCursor,
    });

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
    void persistMessage(storedThreadId, "user", userMessageContent, safeUserMetadata);

    let assistantResponse = "";
    const handleProgress = (event: StreamProgressEvent) => {
      if (streamIdRef.current !== streamId) return;
      setChatPassIndicator((current) => {
        if (!current || current.threadId !== targetThreadId || current.assistantIndex !== assistantIndex) return current;
        const mapped = buildTransientStatusFromProgressEvent(event);
        const now = Date.now();
        const nextElapsed =
          Number.isFinite(Number(event.elapsedMs)) && Number(event.elapsedMs) >= 0
            ? Math.round(Number(event.elapsedMs))
            : current.elapsedMs;
        const nextCursor = Math.max(current.progressCursor, mapped.progressCursor);
        const keepCurrentStage = nextCursor > mapped.progressCursor;
        const fallbackText = mapped.progressMenu[nextCursor] || current.text;
        const nextText = keepCurrentStage ? fallbackText : mapped.text;
        return {
          ...current,
          stage: keepCurrentStage ? current.stage : mapped.stage,
          elapsedMs: nextElapsed,
          lastProgressAtMs: now,
          progressMenu: mapped.progressMenu,
          progressCursor: nextCursor,
          displayCursor: keepCurrentStage ? current.displayCursor : mapped.progressCursor,
          text: nextText,
        };
      });
    };
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
            setChatPassIndicator((current) => {
              if (!current || current.threadId !== targetThreadId || current.assistantIndex !== assistantIndex) return current;
              const canPromoteToCompose = current.progressCursor <= composingStageCursor;
              const now = Date.now();
              return {
                ...current,
                stage: canPromoteToCompose ? "composing" : current.stage,
                lastProgressAtMs: now,
                progressCursor: canPromoteToCompose ? composingStageCursor : current.progressCursor,
                displayCursor: canPromoteToCompose ? composingStageCursor : current.displayCursor,
                text: canPromoteToCompose ? composingStageLabel : current.text,
              };
            });
          },
          onDone: () => {
            if (streamIdRef.current !== streamId) return;
            if (flushFrameRef.current !== null) {
              window.cancelAnimationFrame(flushFrameRef.current);
              flushFrameRef.current = null;
            }
            flushPendingDelta();
            setStatus("idle");
            setChatPassIndicator((current) => {
              if (!current || current.threadId !== targetThreadId || current.assistantIndex !== assistantIndex) return current;
              const fallbackElapsed = Date.now() - current.startedAtMs;
              const canPromoteToFinalize = current.progressCursor <= finalizingStageCursor;
              return {
                ...current,
                stage: canPromoteToFinalize ? "finalizing" : current.stage,
                lastProgressAtMs: Date.now(),
                progressCursor: canPromoteToFinalize ? finalizingStageCursor : current.progressCursor,
                displayCursor: canPromoteToFinalize ? finalizingStageCursor : current.displayCursor,
                text: canPromoteToFinalize ? finalizingStageLabel : current.text,
                elapsedMs:
                  Number.isFinite(current.elapsedMs as number) && (current.elapsedMs as number) >= 0
                    ? current.elapsedMs
                    : fallbackElapsed,
              };
            });
          },
          onProgress: handleProgress,
        },
        {
          conversationKey: targetThreadId,
          documentIds: scopedDocumentIds,
          documentId: scopedDocumentIds.length === 1 ? scopedDocumentIds[0] : undefined,
          topK: scopedDocumentIds.length ? 24 : undefined,
          maxDistance: scopedDocumentIds.length ? null : undefined,
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
      setChatPassIndicator((current) => {
        if (!current || current.threadId !== targetThreadId || current.assistantIndex !== assistantIndex) return current;
        return {
          ...current,
          text: "Falha durante a geracao da resposta.",
          elapsedMs: Date.now() - current.startedAtMs,
        };
      });
      setError(err?.message ?? "Erro ao falar com a Leticia");
    }
  };

  return (
    <main className="flex h-screen min-h-screen bg-[#f7f7f8] text-zinc-900">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="*/*"
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.currentTarget.value = "";
          if (!files.length) return;
          handleComposerFilesForCurrentMode(files);
        }}
      />
      <aside
        className="relative hidden h-full shrink-0 flex-col border-r border-zinc-200 bg-[#f0f0f1] lg:flex"
        style={{ width: chatSidebarWidthPx }}
      >
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
                  onClick={() => handleSidebarAction(action.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[22px] text-zinc-800 hover:bg-zinc-200"
                >
                  <Icon size={20} />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <p className="px-3 text-xs uppercase tracking-[0.14em] text-zinc-500">LeticIA</p>
            <div className="mt-2 space-y-1">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => openThread(thread.id)}
                  className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-[21px] ${
                    activeThread?.id === thread.id ? "bg-zinc-200 text-zinc-900" : "text-zinc-700 hover:bg-zinc-200"
                  }`}
                  title={thread.title}
                >
                  <span className="block min-w-0 truncate">{thread.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="relative mt-auto border-t border-zinc-200 px-4 py-4" ref={userSidebarMenuRef}>
          {isUserSidebarMenuOpen ? (
            <div className="absolute bottom-full left-4 mb-3 w-[292px] rounded-[20px] border border-zinc-300 bg-[#f2f2f3] p-3 shadow-[0_24px_48px_-28px_rgba(15,23,42,0.55)]">
              <div className="rounded-2xl bg-zinc-200/75 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-semibold text-white">
                    EU
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[18px] leading-6 font-semibold text-zinc-900">Usuario KnexIT</p>
                    <p className="truncate text-sm text-zinc-500">@knexit</p>
                  </div>
                </div>
              </div>
              <div className="my-2 h-px bg-zinc-300" />
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => navigateFromUserSidebarMenu("/knexit-workspace/precos")}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-[16px] text-zinc-800 transition hover:bg-white"
                >
                  <Compass size={18} />
                  <span>Fazer upgrade do plano</span>
                </button>
                <button
                  type="button"
                  onClick={() => openSuperadminFromUserSidebarMenu("personalizacao")}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-[16px] text-zinc-800 transition hover:bg-white"
                >
                  <Palette size={18} />
                  <span>Personalização</span>
                </button>
                <button
                  type="button"
                  onClick={() => openSuperadminFromUserSidebarMenu("geral")}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-[16px] text-zinc-800 transition hover:bg-white"
                >
                  <Settings size={18} />
                  <span>Configurações</span>
                </button>
              </div>
              <div className="my-2 h-px bg-zinc-300" />
              <button
                type="button"
                onClick={() => navigateFromUserSidebarMenu("/lobby/recursos/faq")}
                className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-[16px] text-zinc-800 transition hover:bg-white"
              >
                <span className="flex items-center gap-3">
                  <CircleEllipsis size={18} />
                  <span>Ajuda</span>
                </span>
                <ChevronRight size={18} />
              </button>
              <button
                type="button"
                onClick={() => navigateFromUserSidebarMenu("/knexit-workspace/acesso?stay=1")}
                className="mt-0.5 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-[16px] text-zinc-800 transition hover:bg-white"
              >
                <LogOut size={18} />
                <span>Sair</span>
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setIsUserSidebarMenuOpen((current) => !current)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-1 text-left transition hover:bg-zinc-200"
            aria-expanded={isUserSidebarMenuOpen}
            title="Abrir menu do usuario"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
              EU
            </span>
            <div>
              <p className="text-sm font-medium text-zinc-900">Usuario KnexIT</p>
              <p className="text-xs text-zinc-500">Plano Plus · Configuracoes</p>
            </div>
          </button>
        </div>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionar painel de chats"
          onMouseDown={startChatSidebarResize}
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-zinc-400"
        />
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-white">
        <header className="flex h-14 items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-2">
            <Folder size={20} className="text-zinc-500" />
            <ChevronRight size={20} className="text-zinc-400" />
            <h1 className="text-xl font-medium sm:text-[34px]">LeticIA</h1>
          </div>
          <div className="flex items-center gap-2 text-zinc-700">
            <button
              type="button"
              onClick={() => {
                setActiveMode("write");
                setWritingError(null);
                setWritingNotice(null);
              }}
              className="inline-flex items-center rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-200"
            >
              Modo escrita
            </button>
            <Link
              href="/knexai/ingest"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-zinc-200"
            >
              <Upload size={16} />
              <span className="hidden sm:inline">Ingerir arquivo</span>
            </Link>
            <button
              type="button"
              onClick={openIdentityPanel}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
              title="Abrir painel de identificacao"
            >
              <span className="relative inline-flex items-center justify-center">
                <ScanFace size={16} />
                <span
                  className={`absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full border border-white ${resolveIdentityStatusDotClass(identityQuickStatus.status)}`}
                />
              </span>
              <span className="hidden sm:inline">Identificacao</span>
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
              <Composer
                docked={false}
                input={input}
                status={status}
                speechSupported={isSpeechSupported}
                isListening={isListening}
                isUploadingFiles={isUploadingFiles}
                uploadNotice={uploadNotice}
                uploadError={uploadError}
                pendingAttachments={composerPendingAttachmentViews}
                onInputChange={setInput}
                onSend={() => void send(input)}
                onToggleListening={toggleListening}
                onPickFiles={handlePickFiles}
                onFilesSelected={(files) => {
                  queueComposerFiles(files);
                }}
                onRemoveAttachment={removeComposerPendingFile}
              />
            </div>
          ) : (
            <>
              <div
                ref={chatScrollContainerRef}
                onScroll={handleChatScroll}
                className="flex-1 overflow-y-auto [scrollbar-gutter:stable]"
                style={{ scrollPaddingBottom: `${composerReservePx}px` }}
              >
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
                        const messageMetadata = normalizeMessageMetadata(message.metadata);
                        const attachmentItems = message.role === "user" ? extractMessageAttachments(message) : [];
                        const hasPassIndicator =
                          message.role === "assistant" &&
                          Boolean(chatPassIndicator) &&
                          activeThread?.id === chatPassIndicator?.threadId &&
                          index === chatPassIndicator?.assistantIndex;
                        const elapsedLabel = hasPassIndicator ? formatElapsedLabel(chatPassIndicator?.elapsedMs ?? null) : "";
                        const passLineText = hasPassIndicator
                          ? status === "thinking"
                            ? chatPassIndicator?.text || `${INITIAL_THINKING_TEXT}...`
                            : status === "error"
                              ? chatPassIndicator?.text || ""
                              : elapsedLabel
                                ? `Pensou por ${elapsedLabel}`
                                : "Pensou por alguns instantes"
                          : "";
                        const contentToRender =
                          message.role === "assistant" && currentAssistantData ? currentAssistantData.content : message.content;
                        const hideMessageTextForAttachmentNotice =
                          message.role === "user" && messageMetadata?.rag_attachment_notice === true && attachmentItems.length > 0;
                        const shouldRenderContent = Boolean(contentToRender) && !hideMessageTextForAttachmentNotice;
                        const bubbleKey = `${activeThread?.id ?? "thread"}-${index}`;
                        const canSpeakAssistantMessage =
                          message.role === "assistant" && shouldRenderContent && Boolean(contentToRender.trim());
                        const isSpeakingThisMessage =
                          canSpeakAssistantMessage && isSpeaking && speakingMessageKey === bubbleKey;
                        const whitespaceClass = message.role === "assistant" && assistantMode === "plain" ? "whitespace-pre" : "whitespace-pre-wrap";
                        const showTypingPlaceholder =
                          !shouldRenderContent && !(message.role === "assistant" && hasPassIndicator) && !attachmentItems.length;
                        return (
                          <div
                            ref={isLastAssistant ? lastAssistantBubbleRef : null}
                            className={`${whitespaceClass} relative text-[22px] leading-relaxed ${
                              message.role === "user"
                                ? "max-w-[85%] rounded-2xl border border-zinc-200 bg-[#f0f0f1] px-4 py-3 text-zinc-900"
                                : assistantMode === "plain"
                                  ? "w-full max-w-none overflow-x-auto rounded-2xl bg-zinc-100 px-4 py-3 font-mono text-zinc-900"
                                  : "w-full max-w-none text-zinc-900"
                            } ${canSpeakAssistantMessage ? "pr-10" : ""}`}
                          >
                            {canSpeakAssistantMessage ? (
                              <button
                                type="button"
                                onClick={() => speakAssistantMessage(contentToRender, bubbleKey)}
                                className={`absolute right-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-full ${
                                  isSpeakingThisMessage ? "bg-emerald-100 text-emerald-700" : "text-zinc-500 hover:bg-zinc-100"
                                }`}
                                title={isSpeakingThisMessage ? "Parar leitura em voz" : "Ler resposta em voz"}
                                aria-label={isSpeakingThisMessage ? "Parar leitura em voz" : "Ler resposta em voz"}
                              >
                                {isSpeakingThisMessage ? <VolumeX size={15} /> : <Volume2 size={15} />}
                              </button>
                            ) : null}
                            {passLineText ? <div className="mb-2 text-sm text-zinc-500">{passLineText}</div> : null}
                            {shouldRenderContent ? <span>{contentToRender}</span> : null}
                            {showTypingPlaceholder ? (
                              <span className={message.role === "assistant" ? "text-zinc-400" : "text-zinc-300"}>
                                {message.role === "assistant" ? "Pensando para te responder melhor..." : "Digitando..."}
                              </span>
                            ) : null}
                            {attachmentItems.length ? (
                              <div className={`${shouldRenderContent ? "mt-3" : ""} space-y-2`}>
                                {attachmentItems.map((attachment) => {
                                  const visual = resolveFileVisualToken(attachment.fileName, attachment.mimeType);
                                  const Icon = visual.icon;
                                  const shortName = formatShortFileName(attachment.fileName, 40);
                                  return (
                                    <div
                                      key={`${attachment.documentId}-${attachment.sourcePath}`}
                                      className="flex items-center gap-3 rounded-xl border border-zinc-700/70 bg-zinc-800/70 px-3 py-2 text-left"
                                      title={attachment.fileName}
                                    >
                                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${visual.badgeClassName}`}>
                                        <Icon size={14} className={visual.iconClassName} />
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <p className="line-clamp-1 text-sm font-medium text-zinc-100">{shortName}</p>
                                      </div>
                                      <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${visual.badgeClassName}`}>
                                        {visual.shortLabel}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
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
                  <Composer
                    docked
                    input={input}
                    status={status}
                    speechSupported={isSpeechSupported}
                    isListening={isListening}
                    isUploadingFiles={isUploadingFiles}
                    uploadNotice={uploadNotice}
                    uploadError={uploadError}
                    pendingAttachments={composerPendingAttachmentViews}
                    onInputChange={setInput}
                    onSend={() => void send(input)}
                    onToggleListening={toggleListening}
                    onPickFiles={handlePickFiles}
                    onFilesSelected={(files) => {
                      queueComposerFiles(files);
                    }}
                    onRemoveAttachment={removeComposerPendingFile}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {isWritePanelMounted ? (
      <div
        className={`fixed inset-0 z-[60] ${isWritePanelVisible ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={false}
      >
        <div
          className={`absolute inset-0 bg-black/10 transition-opacity duration-[320ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] ${
            isWritePanelVisible ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setActiveMode("chat")}
        />
        <section
          className={`absolute inset-y-0 right-0 flex w-full transform-gpu flex-col bg-[#f4f4f5] will-change-transform transition-transform duration-[320ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] ${
            isWritePanelVisible ? "translate-x-0" : "translate-x-full"
          }`}
        >
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
                className="inline-flex items-center rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-200"
                aria-label="Voltar ao chat"
              >
                Voltar ao chat
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
                    speechSupported={isSpeechSupported}
                    isListening={isListening}
                    isUploadingFiles={isUploadingFiles}
                    uploadNotice={uploadNotice}
                    uploadError={uploadError}
                    pendingAttachments={[]}
                    onInputChange={setWritingPrompt}
                    onSend={() => void sendWritingAssist(writingPrompt)}
                    onToggleListening={toggleListening}
                    onPickFiles={handlePickFiles}
                    onFilesSelected={(files) => {
                      void handleComposerFiles(files);
                    }}
                    onRemoveAttachment={() => {}}
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
      {isChatSearchModalOpen ? (
        <div
          className="fixed inset-0 z-[144] flex items-start justify-center bg-black/30 p-2 sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeChatSearchModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Buscar em chats"
            className="mt-1 flex h-[min(88vh,700px)] w-[min(920px,100%)] flex-col overflow-hidden rounded-[24px] border border-zinc-300 bg-[#f5f5f6] shadow-[0_24px_72px_rgba(15,23,42,0.4)]"
          >
            <div className="flex items-center gap-3 border-b border-zinc-300 px-4 py-3 sm:px-6">
              <input
                ref={chatSearchInputRef}
                value={chatSearchQuery}
                onChange={(event) => setChatSearchQuery(event.target.value)}
                placeholder="Buscar em chats..."
                className="w-full border-0 bg-transparent text-[19px] text-zinc-900 outline-none placeholder:text-zinc-500"
              />
              <button
                type="button"
                onClick={closeChatSearchModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-800"
                aria-label="Fechar busca"
                title="Fechar busca"
              >
                <X size={24} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5">
              <button
                type="button"
                onClick={createNewChatFromSearchModal}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-[17px] text-zinc-900 transition hover:bg-zinc-200"
              >
                <MessageSquarePlus size={20} />
                <span>Novo chat</span>
              </button>

              {chatSearchThreadGroups.length ? (
                <div className="mt-3 space-y-4 pb-2">
                  {chatSearchThreadGroups.map((group) => (
                    <section key={group.label}>
                      <p className="px-2 text-xs font-medium tracking-[0.02em] text-zinc-500">{group.label}</p>
                      <div className="mt-1 space-y-1">
                        {group.threads.map((thread) => (
                          <button
                            key={thread.id}
                            type="button"
                            onClick={() => openThreadFromSearchModal(thread.id)}
                            title={thread.title}
                            className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-[17px] transition ${
                              activeThread?.id === thread.id
                                ? "bg-zinc-200 text-zinc-900"
                                : "text-zinc-800 hover:bg-zinc-200"
                            }`}
                          >
                            <MessageCircle size={19} className="shrink-0" />
                            <span className="min-w-0 truncate">{thread.title}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <p className="px-2 py-6 text-sm text-zinc-500">Nenhum chat encontrado.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {isSuperadminModalOpen ? (
        <div
          className="fixed inset-0 z-[145] flex items-center justify-center bg-black/45 p-3 sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeSuperadminModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Configuracoes do ambiente"
            className="flex h-[min(88vh,760px)] w-[min(980px,100%)] overflow-hidden rounded-[28px] border border-zinc-300 bg-[#f8f8f9] shadow-[0_24px_96px_rgba(0,0,0,0.4)]"
          >
            <aside className="flex h-full w-[250px] shrink-0 flex-col border-r border-zinc-200 bg-[#efeff0] p-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={closeSuperadminModal}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-200"
                  title="Fechar configuracoes"
                  aria-label="Fechar configuracoes"
                >
                  <X size={18} />
                </button>
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Ajustes</span>
              </div>
              <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                {SUPERADMIN_SETTINGS_SECTIONS.map((section) => {
                  const Icon = section.icon;
                  const isActive = superadminActiveSection === section.key;
                  return (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => {
                        setSuperadminActiveSection(section.key);
                        setSuperadminError(null);
                        setSuperadminFeedback(null);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] transition ${
                        isActive ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-700 hover:bg-zinc-200"
                      }`}
                    >
                      <Icon size={17} />
                      <span>{section.label}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            <section className="flex min-h-0 flex-1 flex-col">
              <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
                <h2 className="text-2xl font-medium text-zinc-900">{superadminActiveSectionMeta.label}</h2>
                {superadminActiveSection === "controlar-dados" ? (
                  <button
                    type="button"
                    onClick={() => void loadSuperadminRestrictions()}
                    disabled={isSuperadminLoading}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw size={14} className={isSuperadminLoading ? "animate-spin" : ""} />
                    Atualizar
                  </button>
                ) : null}
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                {superadminActiveSection === "geral" ? (
                  <div className="space-y-4">
                    {isGeneralSecurityBannerVisible ? (
                      <div className="rounded-2xl border border-zinc-200 bg-[#ececee] p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-300 bg-white text-zinc-700">
                              <Lock size={18} />
                            </span>
                            <div>
                              <p className="text-lg font-semibold text-zinc-900">Proteja sua conta</p>
                              <p className="mt-1 text-sm leading-relaxed text-zinc-700">
                                Adicione uma autenticacao multifatorial (MFA) para reforcar o acesso ao ambiente.
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsGeneralSecurityBannerVisible(false)}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-200"
                            title="Ocultar bloco"
                            aria-label="Ocultar bloco"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSuperadminActiveSection("seguranca")}
                          className="mt-4 rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
                        >
                          Configurar MFA
                        </button>
                      </div>
                    ) : null}

                    <div className="rounded-2xl border border-zinc-200 bg-white">
                      <button type="button" className="flex w-full items-center justify-between px-5 py-4 text-left text-base text-zinc-800">
                        <span>Aparencia</span>
                        <span className="inline-flex items-center gap-2 text-zinc-600">
                          Sistema <ChevronDown size={16} />
                        </span>
                      </button>
                      <div className="mx-5 h-px bg-zinc-200" />
                      <button type="button" className="flex w-full items-center justify-between px-5 py-4 text-left text-base text-zinc-800">
                        <span>Cor de enfase</span>
                        <span className="inline-flex items-center gap-2 text-zinc-600">
                          Padrao <ChevronDown size={16} />
                        </span>
                      </button>
                      <div className="mx-5 h-px bg-zinc-200" />
                      <button type="button" className="flex w-full items-center justify-between px-5 py-4 text-left text-base text-zinc-800">
                        <span>Idioma</span>
                        <span className="inline-flex items-center gap-2 text-zinc-600">
                          Autodetectar <ChevronDown size={16} />
                        </span>
                      </button>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                      <p className="text-lg font-medium text-zinc-900">Restricoes Superadmin</p>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                        O controle de memoria compartilhada foi movido para este modal dentro do chat.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSuperadminActiveSection("controlar-dados")}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-200"
                      >
                        <Database size={16} />
                        Abrir controlar dados
                      </button>
                    </div>
                  </div>
                ) : null}

                {superadminActiveSection === "controlar-dados" ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-800">
                        <KeyRound className="h-4 w-4 text-zinc-600" />
                        Chave de superadmin
                      </div>
                      <p className="mb-3 text-xs text-zinc-500">
                        Se `IDENTITY_SUPERADMIN_KEY` estiver configurada no servidor, informe a chave para leitura e gravacao.
                      </p>
                      <input
                        type="password"
                        value={superadminKey}
                        onChange={(event) => setSuperadminKey(event.target.value)}
                        placeholder="x-superadmin-key"
                        className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none ring-sky-500 transition focus:border-sky-500 focus:ring-1"
                      />
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                      <p className="text-base font-semibold text-zinc-900">Memoria compartilhada de identificacao</p>
                      <p className="mt-1 text-sm text-zinc-600">Controla o bloco de memoria de reconhecimento facial no runtime.</p>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                          <span className="text-zinc-800">Permitir memoria compartilhada</span>
                          <button
                            type="button"
                            onClick={() => setAllowSharedIdentityMemory((current) => !current)}
                            className={`inline-flex min-w-[98px] justify-center rounded-md px-3 py-1.5 text-xs font-semibold ${
                              allowSharedIdentityMemory ? "bg-emerald-600 text-white" : "bg-rose-700 text-rose-100"
                            }`}
                          >
                            {allowSharedIdentityMemory ? "Permitido" : "Bloqueado"}
                          </button>
                        </label>

                        <label className="flex flex-col gap-2 text-sm text-zinc-700">
                          <span>Limite de caracteres do prompt</span>
                          <input
                            type="number"
                            min={600}
                            max={24000}
                            step={100}
                            value={maxPromptChars}
                            onChange={(event) => setMaxPromptChars(parseBoundedInt(event.target.value, 4800, 600, 24000))}
                            className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-zinc-900 outline-none ring-sky-500 transition focus:border-sky-500 focus:ring-1"
                          />
                        </label>

                        <label className="flex flex-col gap-2 text-sm text-zinc-700">
                          <span>Atualizado por</span>
                          <input
                            type="text"
                            value={superadminUpdatedBy}
                            onChange={(event) => setSuperadminUpdatedBy(event.target.value)}
                            placeholder="nome do operador"
                            className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-zinc-900 outline-none ring-sky-500 transition focus:border-sky-500 focus:ring-1"
                          />
                        </label>

                        <label className="flex flex-col gap-2 text-sm text-zinc-700">
                          <span>Observacao</span>
                          <input
                            type="text"
                            value={superadminNote}
                            onChange={(event) => setSuperadminNote(event.target.value)}
                            placeholder="motivo da alteracao"
                            className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-zinc-900 outline-none ring-sky-500 transition focus:border-sky-500 focus:ring-1"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void saveSuperadminRestrictions()}
                        disabled={isSuperadminSaving}
                        className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Save className="h-4 w-4" />
                        {isSuperadminSaving ? "Salvando..." : "Salvar restricoes"}
                      </button>
                      <span className="text-xs text-zinc-600">Runtime: {superadminRuntimeState}</span>
                      <span className="text-xs text-zinc-500">
                        Ultima atualizacao: {superadminUpdatedAt ? new Date(superadminUpdatedAt).toLocaleString("pt-BR") : "-"}
                      </span>
                    </div>

                    {superadminAuthRequired && !sanitizeText(superadminKey) ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        Esta rota exige chave superadmin. Informe a chave e clique em Atualizar.
                      </div>
                    ) : null}
                    {superadminError ? (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{superadminError}</div>
                    ) : null}
                    {superadminFeedback ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                        {superadminFeedback}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {superadminActiveSection !== "geral" && superadminActiveSection !== "controlar-dados" ? (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                    <p className="text-lg font-semibold text-zinc-900">{superadminActiveSectionMeta.label}</p>
                    <p className="mt-2 text-sm text-zinc-600">
                      Este painel ainda nao possui configuracoes dedicadas. Use <strong>Controlar dados</strong> para ajustar restricoes
                      de superadmin.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSuperadminActiveSection("controlar-dados")}
                      className="mt-4 rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-200"
                    >
                      Ir para controlar dados
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      ) : null}
      {isIdentityPanelOpen ? (
        <div
          ref={identityPanelRootRef}
          data-identity-panel-root
          className={`fixed z-[140] ${
            isIdentityPanelMinimized
              ? "bottom-4 right-4 h-14 w-[320px] max-w-[calc(100vw-2rem)]"
              : isIdentityPanelMaximized
                ? "inset-0 p-2 sm:p-3"
                : "bottom-4 right-4 h-[82vh] min-h-[520px] w-[min(1220px,calc(100vw-2rem))]"
          }`}
          style={
            !isIdentityPanelMaximized && identityPanelPosition
              ? {
                  left: `${identityPanelPosition.x}px`,
                  top: `${identityPanelPosition.y}px`,
                  right: "auto",
                  bottom: "auto",
                }
              : undefined
          }
        >
          <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[#25314a] bg-[#05070d] shadow-[0_28px_96px_rgba(0,0,0,0.65)]">
            <header
              onMouseDown={startIdentityPanelDrag}
              className={`flex h-12 shrink-0 items-center justify-between border-b border-[#1c2a42] bg-[#0b1322] px-3 ${
                isIdentityPanelMaximized ? "" : "cursor-move select-none"
              }`}
            >
              <div className="flex items-center gap-2 text-slate-100">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#2f4363] bg-[#111d31]">
                  <ScanFace size={15} />
                </span>
                <div>
                  <p className="text-sm font-medium leading-none">Painel de Identificacao</p>
                  <p className="mt-1 text-[11px] leading-none text-slate-400">Conexao de camera e runtime</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={popoutIdentityPanel}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-white/10 hover:text-white"
                  title="Abrir em janela separada"
                  aria-label="Abrir em janela separada"
                >
                  <ExternalLink size={14} />
                </button>
                <button
                  type="button"
                  onClick={isIdentityPanelMinimized ? () => setIsIdentityPanelMinimized(false) : minimizeIdentityPanel}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-white/10 hover:text-white"
                  title={isIdentityPanelMinimized ? "Restaurar painel" : "Minimizar painel"}
                  aria-label={isIdentityPanelMinimized ? "Restaurar painel" : "Minimizar painel"}
                >
                  <Minimize2 size={15} />
                </button>
                <button
                  type="button"
                  onClick={toggleIdentityPanelMaximized}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-white/10 hover:text-white"
                  title={isIdentityPanelMaximized ? "Restaurar tamanho" : "Maximizar painel"}
                  aria-label={isIdentityPanelMaximized ? "Restaurar tamanho" : "Maximizar painel"}
                >
                  {isIdentityPanelMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
                <button
                  type="button"
                  onClick={closeIdentityPanel}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-300 hover:bg-rose-500/20 hover:text-rose-100"
                  title="Fechar painel"
                  aria-label="Fechar painel"
                >
                  <X size={15} />
                </button>
              </div>
            </header>
            {isIdentityPanelMinimized ? (
              <div className="flex flex-1 items-center justify-between bg-[#0a101d] px-3 text-xs text-slate-300">
                <span>Painel minimizado. Clique em restaurar para abrir o palco.</span>
              </div>
            ) : (
              <iframe
                title="Painel de identificacao"
                src="/knexai/identity-runtime?embedded=1"
                className="h-full w-full flex-1 border-0 bg-[#05070d]"
                allow="camera; microphone"
              />
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
