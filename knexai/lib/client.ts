export type LeticiaMessage = {
  role: "user" | "assistant";
  content: string;
  metadata?: Record<string, unknown>;
};

export type PersistedMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type PersistedThread = {
  id: string;
  title: string;
  updatedAt: string;
  lastMessageAt: string | null;
  messages: PersistedMessage[];
};

type StreamHandlers = {
  signal?: AbortSignal;
  onChunk?: (delta: string) => void;
  onStart?: () => void;
  onDone?: () => void;
  onProgress?: (event: StreamProgressEvent) => void;
};

export type StreamProgressEvent = {
  stage: string;
  text: string;
  type?: string | null;
  phase?: string | null;
  runId?: string | null;
  requestId?: string | null;
  ts?: string | null;
  substage?: string | null;
  progressPct?: number | null;
  counters?: Record<string, number> | null;
  target?: {
    docName?: string | null;
    docId?: string | null;
    chapter?: string | null;
    section?: string | null;
    pageCurrent?: number | null;
    pageStart?: number | null;
    pageEnd?: number | null;
    pageTotal?: number | null;
    chunkCurrent?: number | null;
    chunkTotal?: number | null;
  } | null;
  detail?: Record<string, unknown> | null;
  sectionIndex?: number | null;
  sectionTotal?: number | null;
  sectionTitle?: string | null;
  elapsedMs?: number | null;
};

export type RagChatRequestOptions = {
  documentId?: number;
  documentIds?: number[];
  sourceType?: string;
  retrievalEmbeddingModel?: string;
  preferredResponseLanguageId?: string;
  topK?: number;
  maxDistance?: number | null;
  maxResponseTokens?: number;
  temperature?: number;
  seed?: number | null;
};

type RagChatResponse = {
  ok?: boolean;
  code?: string;
  message?: string;
  reply?: {
    role?: "assistant" | "user";
    content?: string;
  };
  metadata?: Record<string, unknown>;
};

const DEFAULT_RAG_MAX_RESPONSE_TOKENS = Math.max(
  256,
  Math.min(65_536, Number(process.env.NEXT_PUBLIC_RAG_MAX_RESPONSE_TOKENS || 32768) || 32768),
);
const STREAM_DELAY_MS = Math.max(8, Number(process.env.NEXT_PUBLIC_CHAT_STREAM_DELAY_MS || 16) || 16);

function resolvePublicApiKey() {
  const byPrimary = `${process.env.NEXT_PUBLIC_PUBLIC_API_KEY || ""}`.trim();
  if (byPrimary) return byPrimary;
  const byLegacy = `${process.env.NEXT_PUBLIC_API_KEY || ""}`.trim();
  if (byLegacy) return byLegacy;
  return "";
}

function createAbortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function normalizeOptionalPositiveInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const normalized = Math.round(parsed);
  return normalized > 0 ? normalized : undefined;
}

function normalizeOptionalFiniteNumber(value: unknown) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizePositiveIntArray(value: unknown, maxItems = 64): number[] {
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

function detectPreferredResponseLanguageIdFromPrompt(prompt: string): string | null {
  const raw = `${prompt || ""}`.trim();
  if (!raw) return null;
  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");

  if (/[\u4E00-\u9FFF]/.test(raw)) return "zh-CN";
  if (/[\u3040-\u30FF]/.test(raw)) return "ja-JP";
  if (/[\uAC00-\uD7AF]/.test(raw)) return "ko-KR";
  if (/[\u0600-\u06FF]/.test(raw)) return "ar-SA";
  if (/[\u0590-\u05FF]/.test(raw)) return "he-IL";
  if (/[\u0900-\u097F]/.test(raw)) return "hi-IN";
  if (/[\u0980-\u09FF]/.test(raw)) return "bn-BD";
  if (/[\u0400-\u04FF]/.test(raw)) return /[іїєґ]/i.test(raw) ? "uk-UA" : "ru-RU";

  if (/\b(responda|responder|escreva|answer|reply|respond)\s+(em|in)\s+(ingles|english)\b/.test(normalized)) return "en-US";
  if (/\b(responda|responder|escreva|answer|reply|respond)\s+(em|in)\s+(portugues|portuguese)\b/.test(normalized))
    return "pt-BR";
  if (/\b(responda|responder|escreva|answer|reply|respond)\s+(em|in)\s+(espanhol|espanol|spanish)\b/.test(normalized))
    return "es-ES";

  const tokens = normalized.split(/[^a-z0-9]+/g).filter(Boolean);
  const score = (hints: string[]) => hints.reduce((acc, hint) => (tokens.includes(hint) ? acc + 1 : acc), 0);
  const ptScore = score(["de", "do", "da", "para", "como", "resenha", "critica", "obra", "texto"]);
  const enScore = score(["the", "and", "with", "what", "which", "analysis", "review", "text", "work"]);
  const esScore = score(["de", "del", "para", "como", "resena", "critica", "texto"]);
  const frScore = score(["de", "du", "pour", "comme", "analyse", "texte"]);

  if (ptScore >= enScore && ptScore >= esScore && ptScore >= frScore && ptScore > 0) return "pt-BR";
  if (enScore > ptScore && enScore >= esScore && enScore >= frScore && enScore > 0) return "en-US";
  if (esScore > ptScore && esScore >= enScore && esScore >= frScore && esScore > 0) return "es-ES";
  if (frScore > 0 && frScore >= ptScore && frScore >= enScore && frScore >= esScore) return "fr-FR";

  return "pt-BR";
}

async function waitWithAbort(ms: number, signal?: AbortSignal) {
  if (ms <= 0) return;
  if (signal?.aborted) throw createAbortError();
  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
      reject(createAbortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function splitForDisplayStreaming(content: string) {
  const segments = content.match(/\S+\s*/g) || [content];
  const chunks: string[] = [];
  let buffer = "";

  for (const segment of segments) {
    buffer += segment;
    const trimmed = segment.trimEnd();
    const endsSentence = /[.!?:;)]$/.test(trimmed);
    if (buffer.length >= 26 || endsSentence || segment.includes("\n")) {
      chunks.push(buffer);
      buffer = "";
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

async function emitAsStreaming(content: string, handlers: StreamHandlers) {
  const chunks = splitForDisplayStreaming(content);
  for (const chunk of chunks) {
    if (handlers.signal?.aborted) throw createAbortError();
    handlers.onChunk?.(chunk);
    await waitWithAbort(STREAM_DELAY_MS, handlers.signal);
  }
}

async function consumePlainTextStream(response: Response, handlers: StreamHandlers) {
  if (!response.body) {
    throw new Error("RAG_STREAM_EMPTY");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    if (handlers.signal?.aborted) throw createAbortError();
    const { done, value } = await reader.read();
    if (done) break;
    const delta = decoder.decode(value, { stream: true });
    if (delta) handlers.onChunk?.(delta);
  }
  const tail = decoder.decode();
  if (tail) handlers.onChunk?.(tail);
}

async function consumeSseStream(response: Response, handlers: StreamHandlers) {
  if (!response.body) {
    throw new Error("RAG_STREAM_EMPTY");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flushEvent = (rawEvent: string) => {
    const lines = rawEvent.split(/\r?\n/);
    let eventName = "message";
    const dataLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("event:")) {
        eventName = trimmed.slice(6).trim().toLowerCase() || "message";
        continue;
      }
      if (trimmed.startsWith("data:")) {
        dataLines.push(trimmed.slice(5).trim());
      }
    }

    const payloadText = dataLines.join("\n").trim();
    if (!payloadText) return;
    let payload: unknown = payloadText;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      // noop
    }

    if (eventName === "delta") {
      if (typeof payload === "string") {
        handlers.onChunk?.(payload);
        return;
      }
      if (payload && typeof payload === "object" && typeof (payload as { text?: unknown }).text === "string") {
        handlers.onChunk?.((payload as { text: string }).text);
      }
      return;
    }

    if (eventName === "progress") {
      if (payload && typeof payload === "object") {
        const parsed = payload as {
          stage?: unknown;
          type?: unknown;
          phase?: unknown;
          runId?: unknown;
          requestId?: unknown;
          ts?: unknown;
          substage?: unknown;
          progressPct?: unknown;
          counters?: unknown;
          target?: unknown;
          detail?: unknown;
          text?: unknown;
          sectionIndex?: unknown;
          sectionTotal?: unknown;
          sectionTitle?: unknown;
          elapsedMs?: unknown;
        };
        const rawTarget = parsed.target && typeof parsed.target === "object" ? (parsed.target as Record<string, unknown>) : null;
        const rawPage = rawTarget?.page && typeof rawTarget.page === "object" ? (rawTarget.page as Record<string, unknown>) : null;
        const rawChunk = rawTarget?.chunk && typeof rawTarget.chunk === "object" ? (rawTarget.chunk as Record<string, unknown>) : null;
        const text = typeof parsed.text === "string" ? parsed.text : "";
        const stage = typeof parsed.stage === "string" ? parsed.stage : "progress";
        handlers.onProgress?.({
          stage,
          text,
          type: typeof parsed.type === "string" ? parsed.type : null,
          phase: typeof parsed.phase === "string" ? parsed.phase : null,
          runId: typeof parsed.runId === "string" ? parsed.runId : null,
          requestId: typeof parsed.requestId === "string" ? parsed.requestId : null,
          ts: typeof parsed.ts === "string" ? parsed.ts : null,
          substage: typeof parsed.substage === "string" ? parsed.substage : null,
          progressPct: Number.isFinite(Number(parsed.progressPct)) ? Number(parsed.progressPct) : null,
          counters:
            parsed.counters && typeof parsed.counters === "object" && !Array.isArray(parsed.counters)
              ? (parsed.counters as Record<string, number>)
              : null,
          target: rawTarget
            ? {
                docName: typeof rawTarget.doc_name === "string" ? rawTarget.doc_name : null,
                docId: typeof rawTarget.doc_id === "string" ? rawTarget.doc_id : null,
                chapter: typeof rawTarget.chapter === "string" ? rawTarget.chapter : null,
                section: typeof rawTarget.section === "string" ? rawTarget.section : null,
                pageCurrent: Number.isFinite(Number(rawPage?.current)) ? Number(rawPage?.current) : null,
                pageStart: Number.isFinite(Number(rawPage?.start)) ? Number(rawPage?.start) : null,
                pageEnd: Number.isFinite(Number(rawPage?.end)) ? Number(rawPage?.end) : null,
                pageTotal: Number.isFinite(Number(rawPage?.total)) ? Number(rawPage?.total) : null,
                chunkCurrent: Number.isFinite(Number(rawChunk?.current)) ? Number(rawChunk?.current) : null,
                chunkTotal: Number.isFinite(Number(rawChunk?.total)) ? Number(rawChunk?.total) : null,
              }
            : null,
          detail:
            parsed.detail && typeof parsed.detail === "object" && !Array.isArray(parsed.detail)
              ? (parsed.detail as Record<string, unknown>)
              : null,
          sectionIndex: Number.isFinite(Number(parsed.sectionIndex)) ? Number(parsed.sectionIndex) : null,
          sectionTotal: Number.isFinite(Number(parsed.sectionTotal)) ? Number(parsed.sectionTotal) : null,
          sectionTitle: typeof parsed.sectionTitle === "string" ? parsed.sectionTitle : null,
          elapsedMs: Number.isFinite(Number(parsed.elapsedMs)) ? Number(parsed.elapsedMs) : null,
        });
      }
      return;
    }

    if (eventName === "error") {
      const message =
        payload && typeof payload === "object" && typeof (payload as { message?: unknown }).message === "string"
          ? (payload as { message: string }).message
          : "RAG_SSE_ERROR";
      throw new Error(message);
    }
  };

  while (true) {
    if (handlers.signal?.aborted) throw createAbortError();
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx = buffer.indexOf("\n\n");
    while (idx >= 0) {
      const rawEvent = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (rawEvent.trim()) flushEvent(rawEvent);
      idx = buffer.indexOf("\n\n");
    }
  }

  const tail = decoder.decode();
  if (tail) {
    buffer += tail;
  }
  if (buffer.trim()) {
    flushEvent(buffer);
  }
}

/**
 * Cliente do endpoint /chat (RAG).
 * Preferencialmente consome stream de texto do backend; cai para JSON quando necessario.
 */
export async function streamLeticia(
  prompt: string,
  history: LeticiaMessage[],
  handlers: StreamHandlers = {},
  options: RagChatRequestOptions = {},
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const apiKey = resolvePublicApiKey();
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  const scopedDocumentIds = normalizePositiveIntArray(options.documentIds);
  const fallbackDocumentId = normalizeOptionalPositiveInt(options.documentId);
  if (!scopedDocumentIds.length && fallbackDocumentId) {
    scopedDocumentIds.push(fallbackDocumentId);
  }
  const primaryDocumentId = scopedDocumentIds.length === 1 ? scopedDocumentIds[0] : fallbackDocumentId;
  const requestMaxResponseTokens = normalizeOptionalPositiveInt(options.maxResponseTokens) || DEFAULT_RAG_MAX_RESPONSE_TOKENS;
  const preferredResponseLanguageId =
    (typeof options.preferredResponseLanguageId === "string" && options.preferredResponseLanguageId.trim()) ||
    detectPreferredResponseLanguageIdFromPrompt(prompt) ||
    undefined;

  const res = await fetch("/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({
      pipeline: "v2",
      message: prompt,
      history,
      maxResponseTokens: requestMaxResponseTokens,
      stream: true,
      streamMode: "sse",
      documentId: primaryDocumentId,
      documentIds: scopedDocumentIds.length ? scopedDocumentIds : undefined,
      composerBound: scopedDocumentIds.length > 0,
      composerAttachmentIds: scopedDocumentIds.length ? scopedDocumentIds : undefined,
      sourceType: typeof options.sourceType === "string" ? options.sourceType : undefined,
      retrievalEmbeddingModel:
        typeof options.retrievalEmbeddingModel === "string" ? options.retrievalEmbeddingModel : undefined,
      preferredResponseLanguageId,
      topK: normalizeOptionalPositiveInt(options.topK),
      maxDistance: normalizeOptionalFiniteNumber(options.maxDistance),
      temperature: normalizeOptionalFiniteNumber(options.temperature),
      seed: options.seed === null ? null : normalizeOptionalFiniteNumber(options.seed),
    }),
    signal: handlers.signal,
  });

  if (!res.ok) {
    let errorCode = `RAG_HTTP_${res.status}`;
    let errorMessage = "";
    try {
      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      if (contentType.includes("application/json")) {
        const payload = (await res.json()) as RagChatResponse;
        if (payload?.code) errorCode = payload.code;
        if (payload?.message) errorMessage = payload.message;
      } else {
        const text = (await res.text()).trim();
        if (text) errorMessage = text.slice(0, 320);
      }
    } catch {
      // noop
    }
    throw new Error(errorMessage ? `${errorCode}: ${errorMessage}` : errorCode);
  }

  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  handlers.onStart?.();
  try {
    if (contentType.includes("application/json")) {
      const payload = (await res.json()) as RagChatResponse;
      if (!payload?.ok) {
        const code = payload?.code || "RAG_CHAT_FAILED";
        const message = payload?.message || "";
        throw new Error(message ? `${code}: ${message}` : code);
      }
      const content = `${payload?.reply?.content || ""}`.trim();
      if (!content) throw new Error("RAG_CHAT_EMPTY_REPLY");
      await emitAsStreaming(content, handlers);
    } else if (contentType.includes("text/event-stream")) {
      await consumeSseStream(res, handlers);
    } else {
      await consumePlainTextStream(res, handlers);
    }
    handlers.onDone?.();
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw error instanceof Error ? error : new Error("RAG_CHAT_STREAM_RENDER_FAILED");
  }
}

function ensureOk(res: Response, label: string) {
  if (res.ok) return;
  throw new Error(`${label}_HTTP_${res.status}`);
}

export async function loadPersistedThreads(sessionId: string): Promise<PersistedThread[]> {
  const url = `/api/knexai/threads?sessionId=${encodeURIComponent(sessionId)}&includeMessages=1`;
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  ensureOk(res, "KNEXAI_THREADS_GET");
  const payload = (await res.json()) as { threads?: PersistedThread[] };
  return Array.isArray(payload?.threads) ? payload.threads : [];
}

export async function createPersistedThread(sessionId: string, title: string): Promise<PersistedThread> {
  const res = await fetch("/api/knexai/threads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, title }),
  });
  ensureOk(res, "KNEXAI_THREADS_POST");
  const payload = (await res.json()) as { thread?: PersistedThread };
  if (!payload?.thread) throw new Error("KNEXAI_THREADS_POST_INVALID");
  return payload.thread;
}

export async function savePersistedMessage(input: {
  sessionId: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const res = await fetch("/api/knexai/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  ensureOk(res, "KNEXAI_MESSAGES_POST");
}

export type WriteChunkView = {
  chunk_id: string;
  project_id: string;
  section_id: string;
  role: string;
  text: string;
  source_type: string;
  chunk_order: number;
  version: number;
  char_count: number;
  token_count: number | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

export type WriteSectionSummaryView = {
  summary_id: string;
  project_id: string;
  section_id: string;
  summary: string;
  summary_version: number;
  source_chunk_count: number;
  last_chunk_id_processed: string | null;
  created_at: string;
  updated_at: string;
  is_stale: boolean;
  stale_reasons: string[];
};

export type WriteProjectGlobalSummaryView = {
  summary_id: string;
  project_id: string;
  summary: string;
  summary_version: number;
  source_chunk_count: number;
  created_at: string;
  updated_at: string;
  is_stale: boolean;
  stale_reasons: string[];
};

export type WriteSectionView = {
  section_id: string;
  project_id: string;
  title: string;
  kind: string;
  order: number;
  objective: string;
  outline_notes: string;
  status: string;
  content: string;
  summary: string;
  summary_record: Record<string, unknown> | null;
  updated_at: string;
  chunks: WriteChunkView[];
};

export type WriteReferenceView = {
  reference_id: string;
  document_id: number;
  source_path: string;
  note: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type WriteProjectView = {
  project_id: string;
  title: string;
  description: string;
  objective: string;
  owner_session_id: string | null;
  status: string;
  process_summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  sections: WriteSectionView[];
  references: WriteReferenceView[];
};

export type WriteProjectListItem = {
  project_id: string;
  title: string;
  status: string;
  updated_at: string;
  sections_count: number;
  references_count: number;
};

type WriteApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

function getWriteApiErrorMessage(payload: unknown) {
  if (payload && typeof payload === "object") {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail.trim();
    if (detail && typeof detail === "object") {
      const msg = (detail as { message?: unknown }).message;
      if (typeof msg === "string" && msg.trim()) return msg.trim();
    }
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
    const code = (payload as { code?: unknown }).code;
    if (typeof code === "string" && code.trim()) return code.trim();
  }
  return "";
}

async function requestWriteApi<T>(path: string, options: WriteApiRequestOptions = {}): Promise<T> {
  const method = options.method || "GET";
  const headers = new Headers();
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(`/api/write${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    signal: options.signal,
  });

  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const message = getWriteApiErrorMessage(payload) || `WRITE_HTTP_${res.status}`;
    throw new Error(message);
  }

  return (payload ?? ({} as T)) as T;
}

export async function listWriteProjects(limit = 20): Promise<WriteProjectListItem[]> {
  const payload = await requestWriteApi<{ projects?: WriteProjectListItem[] }>(`/projects?limit=${Math.max(1, Math.min(200, Math.round(limit)))}`);
  return Array.isArray(payload.projects) ? payload.projects : [];
}

export async function createWriteProject(input: {
  title: string;
  description?: string;
  objective?: string;
  session_id?: string;
  metadata?: Record<string, unknown>;
}): Promise<WriteProjectView> {
  const payload = await requestWriteApi<{ project: WriteProjectView }>("/projects", {
    method: "POST",
    body: {
      title: input.title,
      description: input.description || "",
      objective: input.objective || "",
      session_id: input.session_id,
      metadata: input.metadata || {},
    },
  });
  return payload.project;
}

export async function getWriteProject(projectId: string): Promise<WriteProjectView> {
  const payload = await requestWriteApi<{ project: WriteProjectView }>(`/projects/${encodeURIComponent(projectId)}`);
  return payload.project;
}

export async function listWriteProjectSections(
  projectId: string,
  options: { includeChunks?: boolean; includeSummaries?: boolean } = {},
): Promise<WriteSectionView[]> {
  const includeChunks = options.includeChunks ?? true;
  const includeSummaries = options.includeSummaries ?? true;
  const query = new URLSearchParams({
    include_chunks: includeChunks ? "true" : "false",
    include_summaries: includeSummaries ? "true" : "false",
  });
  const payload = await requestWriteApi<{ sections?: WriteSectionView[] }>(
    `/projects/${encodeURIComponent(projectId)}/sections?${query.toString()}`,
  );
  return Array.isArray(payload.sections) ? payload.sections : [];
}

export async function createWriteSection(
  projectId: string,
  input: {
    title: string;
    kind?: string;
    order?: number;
    objective?: string;
    outline_notes?: string;
    status?: string;
    content?: string;
  },
): Promise<WriteSectionView> {
  const payload = await requestWriteApi<{ section: WriteSectionView }>(`/projects/${encodeURIComponent(projectId)}/sections`, {
    method: "POST",
    body: {
      title: input.title,
      kind: input.kind || "section",
      order: input.order ?? 0,
      objective: input.objective || "",
      outline_notes: input.outline_notes || "",
      status: input.status || "planned",
      content: input.content || "",
    },
  });
  return payload.section;
}

export async function getWriteSectionSummary(sectionId: string): Promise<WriteSectionSummaryView> {
  const payload = await requestWriteApi<{ summary: WriteSectionSummaryView }>(
    `/sections/${encodeURIComponent(sectionId)}/summary`,
  );
  return payload.summary;
}

export async function getWriteProjectGlobalSummary(projectId: string): Promise<WriteProjectGlobalSummaryView> {
  const payload = await requestWriteApi<{ summary: WriteProjectGlobalSummaryView }>(
    `/projects/${encodeURIComponent(projectId)}/summary`,
  );
  return payload.summary;
}

export async function continueWrite(input: {
  project_id: string;
  section_id?: string;
  instruction: string;
  top_k_chunks?: number;
  top_k_memories?: number;
  min_paragraphs?: number;
  max_paragraphs?: number;
  max_tokens?: number;
  temperature?: number;
}): Promise<{
  trace_id: string;
  project_id: string;
  section_id: string;
  chunk: WriteChunkView;
  retrieved_chunk_ids: string[];
  retrieved_memory_ids: string[];
  section_summary_used: WriteSectionSummaryView | null;
  project_global_summary_used: WriteProjectGlobalSummaryView | null;
  top_k_applied: Record<string, number>;
  parameters: Record<string, unknown>;
}> {
  return requestWriteApi("/continue", {
    method: "POST",
    body: {
      project_id: input.project_id,
      section_id: input.section_id,
      instruction: input.instruction,
      top_k_chunks: input.top_k_chunks ?? 6,
      top_k_memories: input.top_k_memories ?? 6,
      min_paragraphs: input.min_paragraphs ?? 2,
      max_paragraphs: input.max_paragraphs ?? 4,
      max_tokens: input.max_tokens ?? 1200,
      temperature: input.temperature ?? 0.2,
    },
  });
}
