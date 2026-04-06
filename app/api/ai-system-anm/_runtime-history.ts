type ChatRole = "user" | "assistant";

export type RuntimeConversationHistoryItem = {
  role: ChatRole;
  content: string;
};

type RuntimeConversationBucket = {
  updatedAt: number;
  turns: RuntimeConversationHistoryItem[];
};

const MAX_CONVERSATIONS = Math.max(
  64,
  Number.parseInt(`${process.env.KNEXAI_RUNTIME_HISTORY_MAX_CONVERSATIONS || "600"}`, 10) || 600,
);
const MAX_TURNS_PER_CONVERSATION = Math.max(
  8,
  Number.parseInt(`${process.env.KNEXAI_RUNTIME_HISTORY_MAX_TURNS || "64"}`, 10) || 64,
);
const CONVERSATION_TTL_MS = Math.max(
  30_000,
  Number.parseInt(`${process.env.KNEXAI_RUNTIME_HISTORY_TTL_MS || "21600000"}`, 10) || 21_600_000,
);

const runtimeConversationStore = new Map<string, RuntimeConversationBucket>();

function normalizeConversationKey(value: string) {
  const key = `${value || ""}`.trim();
  if (!key) return "";
  if (key.length < 4 || key.length > 256) return "";
  return key;
}

function normalizeHistoryItems(items: RuntimeConversationHistoryItem[]) {
  if (!Array.isArray(items) || !items.length) return [] as RuntimeConversationHistoryItem[];
  const normalized: RuntimeConversationHistoryItem[] = [];
  for (const row of items) {
    if (!row || (row.role !== "user" && row.role !== "assistant")) continue;
    const content = `${row.content || ""}`.trim();
    if (!content) continue;
    normalized.push({ role: row.role, content });
  }
  return normalized.slice(-MAX_TURNS_PER_CONVERSATION);
}

function conversationItemFingerprint(item: RuntimeConversationHistoryItem) {
  return `${item.role}:${item.content}`;
}

function arraysEndWith(
  source: RuntimeConversationHistoryItem[],
  suffix: RuntimeConversationHistoryItem[],
) {
  if (!suffix.length) return true;
  if (suffix.length > source.length) return false;
  const sourceOffset = source.length - suffix.length;
  for (let index = 0; index < suffix.length; index += 1) {
    if (conversationItemFingerprint(source[sourceOffset + index]) !== conversationItemFingerprint(suffix[index])) {
      return false;
    }
  }
  return true;
}

function dedupeAdjacent(items: RuntimeConversationHistoryItem[]) {
  if (!items.length) return items;
  const deduped: RuntimeConversationHistoryItem[] = [];
  for (const row of items) {
    const previous = deduped[deduped.length - 1];
    if (previous && conversationItemFingerprint(previous) === conversationItemFingerprint(row)) continue;
    deduped.push(row);
  }
  return deduped;
}

function trimTurns(items: RuntimeConversationHistoryItem[]) {
  return items.slice(-MAX_TURNS_PER_CONVERSATION);
}

function mergeTurns(
  stored: RuntimeConversationHistoryItem[],
  incoming: RuntimeConversationHistoryItem[],
) {
  if (!incoming.length) return trimTurns(stored);
  if (!stored.length) return trimTurns(incoming);

  const storedTail = stored.slice(-Math.min(10, stored.length));
  if (arraysEndWith(incoming, storedTail)) return trimTurns(incoming);

  const incomingTail = incoming.slice(-Math.min(10, incoming.length));
  if (arraysEndWith(stored, incomingTail)) return trimTurns(stored);

  return trimTurns(dedupeAdjacent([...stored, ...incoming]));
}

function cleanupExpiredBuckets(now = Date.now()) {
  for (const [key, bucket] of runtimeConversationStore.entries()) {
    if (now - bucket.updatedAt > CONVERSATION_TTL_MS) {
      runtimeConversationStore.delete(key);
    }
  }
  if (runtimeConversationStore.size <= MAX_CONVERSATIONS) return;

  const bucketsByAge = [...runtimeConversationStore.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt);
  const excess = runtimeConversationStore.size - MAX_CONVERSATIONS;
  for (let index = 0; index < excess; index += 1) {
    const item = bucketsByAge[index];
    if (!item) break;
    runtimeConversationStore.delete(item[0]);
  }
}

export function hydrateRuntimeConversationHistory(
  conversationKey: string,
  incomingHistory: RuntimeConversationHistoryItem[],
) {
  cleanupExpiredBuckets();
  const key = normalizeConversationKey(conversationKey);
  const normalizedIncoming = normalizeHistoryItems(incomingHistory);
  if (!key) return normalizedIncoming;

  const now = Date.now();
  const stored = runtimeConversationStore.get(key)?.turns || [];
  const merged = mergeTurns(stored, normalizedIncoming);
  runtimeConversationStore.set(key, { updatedAt: now, turns: merged });
  return merged;
}

export function rememberRuntimeConversationTurn(
  conversationKey: string,
  userPrompt: string,
  assistantAnswer: string,
) {
  cleanupExpiredBuckets();
  const key = normalizeConversationKey(conversationKey);
  if (!key) return;

  const userContent = `${userPrompt || ""}`.trim();
  const assistantContent = `${assistantAnswer || ""}`.trim();
  if (!userContent || !assistantContent) return;

  const now = Date.now();
  const stored = runtimeConversationStore.get(key)?.turns || [];
  const nextTurns = dedupeAdjacent([
    ...stored,
    { role: "user", content: userContent },
    { role: "assistant", content: assistantContent },
  ]);
  runtimeConversationStore.set(key, {
    updatedAt: now,
    turns: trimTurns(nextTurns),
  });
}
