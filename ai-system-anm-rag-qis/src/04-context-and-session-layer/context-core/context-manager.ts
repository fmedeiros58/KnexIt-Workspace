export interface ContextManagerInput {
  normalizedMessage: string;
  recentBuffer: string[];
  memoryHints: string[];
  existingConstraints: string[];
  safetyFlags: string[];
  urgency: "low" | "medium" | "high";
  continuityScore: number;
}

export interface ContextManagerOutput {
  activeContext: string[];
  derivedConstraints: string[];
  topicHints: string[];
  proactivityMode: "low" | "medium" | "high";
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function compactLine(value: string, maxChars = 280) {
  const safe = value.replace(/\s+/g, " ").trim();
  if (safe.length <= maxChars) return safe;
  return `${safe.slice(0, maxChars - 1)}...`;
}

function extractTopicHints(text: string) {
  const hints = text
    .toLowerCase()
    .match(/\b([a-z\u00c0-\u017f]{4,})\b/gu) || [];
  return [...new Set(hints)].slice(0, 8);
}

export function contextManager(input: ContextManagerInput): ContextManagerOutput {
  const baselineContext = [
    compactLine(input.normalizedMessage),
    ...input.recentBuffer.slice(-5).map((item) => compactLine(item)),
    ...input.memoryHints.slice(0, 4).map((item) => compactLine(item)),
  ].filter(Boolean);

  const activeContext = [...new Set(baselineContext)].slice(0, 10);
  const derivedConstraints = [...new Set(input.existingConstraints)].slice(-8);

  if (input.safetyFlags.length > 0) derivedConstraints.push("respect_safety_constraints");
  if (input.continuityScore > 0.45) derivedConstraints.push("preserve_topic_continuity");
  if (input.urgency === "high") derivedConstraints.push("prioritize_direct_resolution");

  const topicHints = extractTopicHints(`${input.normalizedMessage} ${input.recentBuffer.slice(-2).join(" ")}`);
  const proactivityMode: "low" | "medium" | "high" =
    input.urgency === "high" ? "high" : topicHints.length >= 4 ? "medium" : "low";

  const score = Math.max(0.2, Math.min(0.98, 0.45 + (activeContext.length * 0.04) + (input.continuityScore * 0.2)));

  return {
    activeContext,
    derivedConstraints: [...new Set(derivedConstraints)].slice(-12),
    topicHints,
    proactivityMode,
    ok: true,
    component: "context-manager",
    score: Number(score.toFixed(4)),
    detail: `context_items=${activeContext.length}`,
    context: {
      continuityScore: input.continuityScore,
      topicHints,
    },
  };
}
