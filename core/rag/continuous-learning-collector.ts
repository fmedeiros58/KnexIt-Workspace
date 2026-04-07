import { createHash } from "crypto";

import { logger } from "../utils/logger";
import { createDocumentIngestionService } from "./document-ingestion-service";

type ChatRole = "user" | "assistant";
type ChatHistoryItem = { role: ChatRole; content: string };
type CapturePhase = "input" | "output";

export type ContinuousLearningCaptureInput = {
  conversationKey: string;
  userKey?: string;
  prompt: string;
  answer?: string;
  history?: ChatHistoryItem[];
  route?: string;
  mode?: string;
  source?: string;
  phase?: CapturePhase;
  intentFamily?: string | null;
  tags?: string[];
};

type CollectorConfig = {
  enabled: boolean;
  maxPromptChars: number;
  maxAnswerChars: number;
  maxHistoryChars: number;
  historyWindow: number;
  dedupTtlMs: number;
  ingestionTimeoutMs: number;
  sourceType: string;
  compactionMode: "none" | "light" | "aggressive";
};

const DEFAULT_CONFIG: CollectorConfig = {
  enabled: true,
  maxPromptChars: 8_000,
  maxAnswerChars: 12_000,
  maxHistoryChars: 6_000,
  historyWindow: 10,
  dedupTtlMs: 90_000,
  ingestionTimeoutMs: 4_000,
  sourceType: "ai_system_anm_continuous_turn",
  compactionMode: "light",
};

let ingestionService: ReturnType<typeof createDocumentIngestionService> | null = null;
let collectorQueue = Promise.resolve();
const recentHashes = new Map<string, number>();

function parseBooleanFlag(value: string | undefined, fallback: boolean) {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parsePositiveInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function normalizeText(value: string) {
  return `${value || ""}`.replace(/\r\n/g, "\n").trim();
}

function truncateText(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  if (maxChars < 12) return value.slice(0, maxChars);
  return `${value.slice(0, maxChars - 3)}...`;
}

function compactText(value: string, mode: CollectorConfig["compactionMode"]) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  if (mode === "none") return normalized;

  const compacted = normalized
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  if (mode === "light") return compacted;

  const uniqueLines = Array.from(new Set(compacted.split("\n").map((line) => line.trim()).filter(Boolean)));
  return uniqueLines.join("\n");
}

function resolveCollectorConfig(): CollectorConfig {
  const modeRaw = `${process.env.AI_SYSTEM_ANM_CONTINUOUS_COLLECTION_COMPACTION || ""}`.trim().toLowerCase();
  const compactionMode: CollectorConfig["compactionMode"] =
    modeRaw === "none" || modeRaw === "aggressive" || modeRaw === "light"
      ? modeRaw
      : DEFAULT_CONFIG.compactionMode;

  return {
    enabled: parseBooleanFlag(
      process.env.AI_SYSTEM_ANM_CONTINUOUS_COLLECTION_ENABLED,
      DEFAULT_CONFIG.enabled,
    ),
    maxPromptChars: parsePositiveInt(
      process.env.AI_SYSTEM_ANM_CONTINUOUS_COLLECTION_MAX_PROMPT_CHARS,
      DEFAULT_CONFIG.maxPromptChars,
      128,
      200_000,
    ),
    maxAnswerChars: parsePositiveInt(
      process.env.AI_SYSTEM_ANM_CONTINUOUS_COLLECTION_MAX_ANSWER_CHARS,
      DEFAULT_CONFIG.maxAnswerChars,
      128,
      300_000,
    ),
    maxHistoryChars: parsePositiveInt(
      process.env.AI_SYSTEM_ANM_CONTINUOUS_COLLECTION_MAX_HISTORY_CHARS,
      DEFAULT_CONFIG.maxHistoryChars,
      128,
      200_000,
    ),
    historyWindow: parsePositiveInt(
      process.env.AI_SYSTEM_ANM_CONTINUOUS_COLLECTION_HISTORY_WINDOW,
      DEFAULT_CONFIG.historyWindow,
      0,
      50,
    ),
    dedupTtlMs: parsePositiveInt(
      process.env.AI_SYSTEM_ANM_CONTINUOUS_COLLECTION_DEDUP_TTL_MS,
      DEFAULT_CONFIG.dedupTtlMs,
      0,
      15 * 60_000,
    ),
    ingestionTimeoutMs: parsePositiveInt(
      process.env.AI_SYSTEM_ANM_CONTINUOUS_COLLECTION_INGEST_TIMEOUT_MS,
      DEFAULT_CONFIG.ingestionTimeoutMs,
      300,
      30_000,
    ),
    sourceType:
      `${process.env.AI_SYSTEM_ANM_CONTINUOUS_COLLECTION_SOURCE_TYPE || ""}`.trim() ||
      DEFAULT_CONFIG.sourceType,
    compactionMode,
  };
}

function getIngestionService() {
  if (!ingestionService) ingestionService = createDocumentIngestionService();
  return ingestionService;
}

function buildHistoryBlock(input: ContinuousLearningCaptureInput, config: CollectorConfig) {
  const history = Array.isArray(input.history) ? input.history.slice(-config.historyWindow) : [];
  if (!history.length) return "";
  const flattened = history
    .map((item) => `${item.role}: ${normalizeText(item.content)}`)
    .filter(Boolean)
    .join("\n");
  return truncateText(compactText(flattened, config.compactionMode), config.maxHistoryChars);
}

function buildCaptureDocument(input: ContinuousLearningCaptureInput, config: CollectorConfig) {
  const phase = input.phase || "output";
  const prompt = truncateText(compactText(input.prompt || "", config.compactionMode), config.maxPromptChars);
  const answer = truncateText(compactText(input.answer || "", config.compactionMode), config.maxAnswerChars);
  const historyBlock = buildHistoryBlock(input, config);
  const tags = Array.from(new Set((input.tags || []).map((tag) => `${tag}`.trim()).filter(Boolean)));

  const headerLines = [
    `captured_at: ${new Date().toISOString()}`,
    `phase: ${phase}`,
    `conversation_key: ${input.conversationKey || "unknown"}`,
    `user_key: ${input.userKey || "unknown"}`,
    `route: ${input.route || "unknown"}`,
    `mode: ${input.mode || "unknown"}`,
    `source: ${input.source || "unknown"}`,
    `intent_family: ${input.intentFamily || "none"}`,
    `tags: ${tags.join(",") || "none"}`,
    `collector: ai-system-anm-continuous-learning-v1`,
    `compaction_mode: ${config.compactionMode}`,
  ];

  const parts = [
    "# AI-SYSTEM-ANM Continuous Learning Capture",
    headerLines.join("\n"),
    "## User Prompt",
    prompt || "[empty_prompt]",
  ];

  if (answer) {
    parts.push("## Assistant Answer");
    parts.push(answer);
  }

  if (historyBlock) {
    parts.push("## Recent History");
    parts.push(historyBlock);
  }

  return parts.join("\n\n");
}

function sweepDedupMap(now: number, ttlMs: number) {
  if (!recentHashes.size) return;
  if (recentHashes.size > 2_000 || ttlMs === 0) {
    for (const [key, at] of recentHashes.entries()) {
      if (ttlMs === 0 || now - at > ttlMs) recentHashes.delete(key);
    }
  }
}

function shouldSkipByDedup(hash: string, config: CollectorConfig) {
  if (config.dedupTtlMs <= 0) return false;
  const now = Date.now();
  sweepDedupMap(now, config.dedupTtlMs);
  const last = recentHashes.get(hash) || 0;
  if (last > 0 && now - last < config.dedupTtlMs) return true;
  recentHashes.set(hash, now);
  return false;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutLabel: string): Promise<T> {
  if (timeoutMs <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutLabel)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function ingestCapture(input: ContinuousLearningCaptureInput): Promise<void> {
  const config = resolveCollectorConfig();
  if (!config.enabled) return;

  const conversationKey = `${input.conversationKey || ""}`.trim();
  const prompt = `${input.prompt || ""}`.trim();
  if (!conversationKey || !prompt) return;

  const document = buildCaptureDocument(
    {
      ...input,
      conversationKey,
      prompt,
      answer: `${input.answer || ""}`.trim(),
    },
    config,
  );
  const hash = createHash("sha256").update(document).digest("hex");
  if (shouldSkipByDedup(hash, config)) return;

  const fileName = `ai-system-anm-turn-${Date.now()}-${hash.slice(0, 12)}.md`;
  const title = `ai-system-anm capture ${input.phase || "output"} ${hash.slice(0, 8)}`;
  const bytes = Buffer.from(document, "utf8");

  await withTimeout(
    getIngestionService().ingest({
      kind: "upload",
      fileName,
      mimeType: "text/markdown; charset=utf-8",
      bytes,
      title,
      sourceType: config.sourceType,
      metadata: {
        capture_kind: "continuous_learning",
        phase: input.phase || "output",
        route: input.route || null,
        mode: input.mode || null,
        source: input.source || null,
        intent_family: input.intentFamily || null,
        tags: Array.isArray(input.tags) ? input.tags : [],
        conversation_key: conversationKey,
        user_key: input.userKey || null,
        prompt_length: prompt.length,
        answer_length: `${input.answer || ""}`.trim().length,
      },
      actor: {
        userId: input.userKey || null,
        sessionId: conversationKey,
        channel: "system",
      },
    }),
    config.ingestionTimeoutMs,
    `AI_SYSTEM_ANM_CONTINUOUS_INGEST_TIMEOUT (${config.ingestionTimeoutMs}ms)`,
  );
}

export function enqueueContinuousLearningCapture(input: ContinuousLearningCaptureInput): void {
  collectorQueue = collectorQueue
    .then(() => ingestCapture(input))
    .catch((error) => {
      logger.warn("AI_SYSTEM_ANM_CONTINUOUS_COLLECTION_FAILED", {
        message: error instanceof Error ? error.message : String(error),
        source: input.source || "unknown",
        phase: input.phase || "output",
      });
    });
}

export async function collectContinuousLearningCapture(input: ContinuousLearningCaptureInput): Promise<void> {
  try {
    await ingestCapture(input);
  } catch (error) {
    logger.warn("AI_SYSTEM_ANM_CONTINUOUS_COLLECTION_FAILED", {
      message: error instanceof Error ? error.message : String(error),
      source: input.source || "unknown",
      phase: input.phase || "output",
    });
  }
}

