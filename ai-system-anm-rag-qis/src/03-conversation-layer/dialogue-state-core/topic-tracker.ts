export interface TopicTrackerInput {
  text: string;
  fallbackTopic?: string;
}

export interface TopicTrackerResult {
  topic: string;
  shiftDetected: boolean;
}

function normalize(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function topicTracker(input: TopicTrackerInput): TopicTrackerResult {
  const normalized = normalize(input.text);
  if (!normalized) return { topic: input.fallbackTopic || "general", shiftDetected: false };

  const topic =
    /\b(nome|chamar|identidade|name)\b/.test(normalized) ? "identity" :
    /\b(erro|bug|build|deploy|c[oó]digo|api|pipeline)\b/.test(normalized) ? "engineering" :
    /\b(resumo|explica|ensina|conceito)\b/.test(normalized) ? "learning" :
    "general";

  return {
    topic,
    shiftDetected: Boolean(input.fallbackTopic && input.fallbackTopic !== topic),
  };
}
