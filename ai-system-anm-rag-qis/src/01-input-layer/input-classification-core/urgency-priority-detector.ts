export interface UrgencyPriorityDetectorInput {
  text: string;
}

export interface UrgencyPriorityDetectorOutput {
  urgency: "low" | "medium" | "high";
  confidence: number;
  reasons: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

const HIGH_PATTERNS = [
  /\b(urgente|asap|imediato|immediately|agora|hoje ainda|production down|incidente|sev1|critical)\b/i,
  /\b(n[oã]o funciona|falhou|quebrou|erro cr[ií]tico|servi[cç]o fora)\b/i,
];

const MEDIUM_PATTERNS = [
  /\b(hoje|amanh[aã]|this week|essa semana|prioridade)\b/i,
  /\b(importante|important|deadline|prazo)\b/i,
];

export function urgencyPriorityDetector(input: UrgencyPriorityDetectorInput): UrgencyPriorityDetectorOutput {
  const text = input.text || "";
  const reasons: string[] = [];

  const hasHigh = HIGH_PATTERNS.some((pattern) => {
    const matched = pattern.test(text);
    if (matched) reasons.push(`high:${pattern.source}`);
    return matched;
  });

  if (hasHigh) {
    return {
      urgency: "high",
      confidence: 0.9,
      reasons,
      ok: true,
      component: "urgency-priority-detector",
      score: 0.9,
      detail: "high",
      context: { reasons },
    };
  }

  const hasMedium = MEDIUM_PATTERNS.some((pattern) => {
    const matched = pattern.test(text);
    if (matched) reasons.push(`medium:${pattern.source}`);
    return matched;
  });

  if (hasMedium) {
    return {
      urgency: "medium",
      confidence: 0.72,
      reasons,
      ok: true,
      component: "urgency-priority-detector",
      score: 0.72,
      detail: "medium",
      context: { reasons },
    };
  }

  return {
    urgency: "low",
    confidence: 0.58,
    reasons,
    ok: true,
    component: "urgency-priority-detector",
    score: 0.58,
    detail: "low",
    context: { reasons },
  };
}
